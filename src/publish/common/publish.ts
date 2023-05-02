/*
 * publish.ts
 *
 * Copyright (C) 2022 Posit Software, PBC
 */

import { info } from "log/mod.ts";
import * as colors from "fmt/colors.ts";
import { ensureDirSync, walkSync } from "fs/mod.ts";

import { Input } from "cliffy/prompt/input.ts";
import { Select } from "cliffy/prompt/select.ts";
import { Confirm } from "cliffy/prompt/confirm.ts";

import { dirname, join, relative } from "path/mod.ts";
import { crypto } from "crypto/mod.ts";
import { encode as hexEncode } from "encoding/hex.ts";

import { sleep } from "../../core/wait.ts";
import { pathWithForwardSlashes } from "../../core/path.ts";
import { completeMessage, withSpinner } from "../../core/console.ts";
import { fileProgress } from "../../core/progress.ts";

import { PublishRecord } from "../types.ts";
import { PublishFiles } from "../provider-types.ts";
import { gfmAutoIdentifier } from "../../core/pandoc/pandoc-id.ts";
import { randomHex } from "../../core/random.ts";
import { copyTo } from "../../core/copy.ts";
import { isHtmlContent, isPdfContent } from "../../core/mime.ts";
import { globalTempContext } from "../../core/temp.ts";
import { formatResourcePath } from "../../core/resources.ts";
import { encodeAttributeValue } from "../../core/html.ts";
import { capitalizeWord } from "../../core/text.ts";
import { RenderFlags } from "../../command/render/types.ts";

export interface PublishSite {
  id?: string;
  url?: string;
  code?: boolean;
}

export interface PublishDeploy {
  id?: string;
  state?: string;
  required?: string[];
  url?: string;
  admin_url?: string;
  launch_url?: string;
}

export interface AccountSite {
  url: string;
}

export interface PublishHandler<
  Site extends PublishSite = PublishSite,
  Deploy extends PublishDeploy = PublishDeploy,
> {
  name: string;
  slugAvailable?: (slug: string) => Promise<boolean>;
  createSite: (
    type: "document" | "site",
    title: string,
    slug: string,
  ) => Promise<Site>;
  createDeploy: (
    siteId: string,
    files: Record<string, string>,
    size: number,
  ) => Promise<Deploy>;
  getDeploy: (deployId: string) => Promise<Deploy>;
  uploadDeployFile: (
    deployId: string,
    path: string,
    fileBody: Blob,
  ) => Promise<void>;
  updateAccountSite?: () => Promise<AccountSite>;
}

export async function handlePublish<
  Site extends PublishSite,
  Deploy extends PublishDeploy,
>(
  handler: PublishHandler<Site, Deploy>,
  type: "document" | "site",
  title: string,
  slug: string,
  render: (flags?: RenderFlags) => Promise<PublishFiles>,
  target?: PublishRecord,
): Promise<[PublishRecord, URL | undefined]> {
  // determine target (create new site if necessary)
  if (!target?.id) {
    // prompt for a slug if possible
    if (handler.slugAvailable) {
      slug = await promptForSlug(type, handler.slugAvailable, slug);
    }

    // create site
    info("");
    await withSpinner({
      message: `Creating ${handler.name} ${type}`,
    }, async () => {
      const site = await handler.createSite(type, title, slug);
      target = {
        id: site.id!,
        url: site.url!,
        code: !!site.code,
      };
    });
    info("");
  }
  target = target!;

  // render
  const publishFiles = await renderForPublish(
    render,
    handler.name,
    type,
    title,
    type === "site" ? target.url : undefined,
  );

  // function to resolve the full path of a file
  // (given that redirects could be in play)
  const publishFilePath = (file: string) => {
    return join(publishFiles.baseDir, file);
  };

  // build file list
  let siteDeploy: Deploy | undefined;
  const files: Array<[string, string]> = [];
  await withSpinner({
    message: `Preparing to publish ${type}`,
  }, async () => {
    const textDecoder = new TextDecoder();
    let size = 0;
    for (const file of publishFiles.files) {
      const filePath = publishFilePath(file);
      const fileBuffer = Deno.readFileSync(filePath);
      size = size + fileBuffer.byteLength;
      const sha1 = await crypto.subtle.digest("SHA-1", fileBuffer);
      const encodedSha1 = hexEncode(new Uint8Array(sha1));
      files.push([file, textDecoder.decode(encodedSha1)]);
    }

    // create deploy
    const deploy = {
      files: {} as Record<string, string>,
    };
    // On windows, be sure sure we normalize the slashes
    for (const file of files) {
      deploy.files[`/${pathWithForwardSlashes(file[0])}`] = file[1];
    }
    siteDeploy = await handler.createDeploy(
      target!.id,
      deploy.files,
      size,
    );

    // wait for it to be ready
    while (true) {
      siteDeploy = await handler.getDeploy(siteDeploy.id!);
      if (siteDeploy.state === "prepared" || siteDeploy.state === "ready") {
        break;
      }
      await sleep(250);
    }
  });

  // compute required files
  const required = siteDeploy?.required!.map((sha1) => {
    const file = files.find((file) => file[1] === sha1);
    return file ? file[0] : null;
  }).filter((file) => file) as string[];

  // upload with progress
  const progress = fileProgress(required);
  await withSpinner({
    message: () => `Uploading files ${progress.status()}`,
    doneMessage: false,
  }, async () => {
    for (const requiredFile of required) {
      const filePath = publishFilePath(requiredFile);
      const fileArray = Deno.readFileSync(filePath);
      await handler.uploadDeployFile(
        siteDeploy?.id!,
        requiredFile,
        new Blob([fileArray.buffer]),
      );
      progress.next();
    }
  });
  completeMessage(`Uploading files (complete)`);

  // wait on ready
  let targetUrl = target.url;
  let adminUrl = target.url;
  let launchUrl = target.url;
  await withSpinner({
    message: `Deploying published ${type}`,
  }, async () => {
    while (true) {
      const deployReady = await handler.getDeploy(siteDeploy?.id!);
      if (deployReady.state === "ready") {
        targetUrl = deployReady.url || targetUrl;
        adminUrl = deployReady.admin_url || targetUrl;
        launchUrl = deployReady.launch_url || adminUrl;
        break;
      }
      await sleep(500);
    }
  });

  // Complete message.
  completeMessage(`Published ${type}: ${targetUrl}`);

  // If the handler provides an update account site function, call it.
  if (handler.updateAccountSite) {
    let accountSite: AccountSite;
    await withSpinner({
      message: `Updating account site`,
      doneMessage: false,
    }, async () => {
      accountSite = await handler.updateAccountSite!();
    });
    completeMessage(`Account site updated: ${accountSite!.url}`);
  }

  // Spacer.
  info("");

  return [
    { ...target, url: targetUrl },
    launchUrl ? new URL(launchUrl) : undefined,
  ];
}

export async function renderForPublish(
  render: (flags?: RenderFlags) => Promise<PublishFiles>,
  providerName: string,
  type: "document" | "site",
  title: string,
  siteUrl?: string,
) {
  // render
  let publishFiles = await render({ siteUrl });

  // validate that the main document is html or pdf
  if (
    type === "document" &&
    !isHtmlContent(publishFiles.rootFile) &&
    !isPdfContent(publishFiles.rootFile)
  ) {
    throw new Error(
      `Documents published to ${providerName} must be either HTML or PDF.`,
    );
  }

  // if this is a document then stage the files
  if (type === "document") {
    publishFiles = stageDocumentPublish(title, publishFiles);
  }

  return publishFiles;
}

function stageDocumentPublish(title: string, publishFiles: PublishFiles) {
  // create temp dir
  const publishDir = globalTempContext().createDir();

  // copy all files to it
  const stagedFiles = window.structuredClone(publishFiles) as PublishFiles;
  stagedFiles.baseDir = publishDir;
  for (const file of publishFiles.files) {
    const src = join(publishFiles.baseDir, file);
    const target = join(stagedFiles.baseDir, file);
    ensureDirSync(dirname(target));
    copyTo(src, target);
  }

  // if this is an html document that isn't index.html then
  // create an index.html and add it to the staged dir
  const kIndex = "index.html";
  if (isHtmlContent(publishFiles.rootFile)) {
    if (stagedFiles.rootFile !== "index.html") {
      copyTo(
        join(stagedFiles.baseDir, stagedFiles.rootFile),
        join(stagedFiles.baseDir, kIndex),
      );
    }
  } else if (isPdfContent(publishFiles.rootFile)) {
    // copy pdf.js into the publish dir and add to staged files
    const src = formatResourcePath("pdf", "pdfjs");
    const dest = join(stagedFiles.baseDir, "pdfjs");
    for (const walk of walkSync(src)) {
      if (walk.isFile) {
        const destFile = join(dest, relative(src, walk.path));
        ensureDirSync(dirname(destFile));
        copyTo(walk.path, destFile);
        stagedFiles.files.push(relative(stagedFiles.baseDir, destFile));
      }
    }
    // write an index file that serves the pdf
    const indexHtml = `<!DOCTYPE html>
<html>
<head>
<title>${encodeAttributeValue(title)}</title>
<style type="text/css">
  body, html {
    margin: 0; padding: 0; height: 100%; overflow: hidden;
  }
</style>
</head>
<body>
<iframe id="pdf-js-viewer" src="pdfjs/web/viewer.html?file=../../${
      encodeAttributeValue(stagedFiles.rootFile)
    }" title="${
      encodeAttributeValue(title)
    }" frameborder="0" width="100%" height="100%"></iframe>

</body>
</html>
`;
    Deno.writeTextFileSync(join(stagedFiles.baseDir, kIndex), indexHtml);
  }

  // make sure the root file is index.html
  if (!stagedFiles.files.includes(kIndex)) {
    stagedFiles.files.push(kIndex);
  }
  stagedFiles.rootFile = kIndex;

  // return staged directory
  return stagedFiles;
}

async function promptForSlug(
  type: "document" | "site",
  slugAvailable: (slug: string) => Promise<boolean>,
  slug: string,
) {
  // if the generated slug is available then try to confirm it
  // (for documents append random noise as a fallback)
  const available = await slugAvailable(slug);
  if (!available && type === "document") {
    slug = slug + "-" + randomHex(4);
  }

  if (await slugAvailable(slug)) {
    const kConfirmed = "confirmed";
    const input = await Select.prompt({
      indent: "",
      message: `${typeName(type)} name:`,
      options: [
        {
          name: slug,
          value: kConfirmed,
        },
        {
          name: "Use another name...",
          value: "another",
        },
      ],
    });
    if (input === kConfirmed) {
      return slug;
    }
  }

  // prompt until we get a name that isn't taken
  let hint: string | undefined =
    `The ${
      typeName(type).toLowerCase()
    } name is included within your published URL\n` +
    `  (e.g. https://username.quarto.pub/${slug}/)`;

  while (true) {
    // prompt for server
    const input = await Input.prompt({
      indent: "",
      message: `Publish with name:`,
      hint,
      transform: (slug: string) => gfmAutoIdentifier(slug, false),
      validate: (slug: string) => {
        if (slug.length === 0) {
          return true; // implies cancel
        } else if (slug.length < 2) {
          return `${typeName(type)} name must be at least 2 characters.`;
        } else {
          return true;
        }
      },
    });
    hint = undefined;
    if (input.length === 0) {
      throw new Error();
    }
    if (await slugAvailable(input)) {
      return input;
    } else {
      info(
        colors.red(
          `  The specified name is already in use within your account.`,
        ),
      );
    }
  }
}

function typeName(type: string) {
  return capitalizeWord(type);
}
