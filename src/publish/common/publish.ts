/*
* publish.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { info } from "log/mod.ts";
import * as colors from "fmt/colors.ts";

import { Input } from "cliffy/prompt/input.ts";
import { Select } from "cliffy/prompt/select.ts";

import { existsSync } from "fs/mod.ts";
import { join } from "path/mod.ts";
import { crypto } from "crypto/mod.ts";
import { encode as hexEncode } from "encoding/hex.ts";

import { sleep } from "../../core/wait.ts";
import { completeMessage, withSpinner } from "../../core/console.ts";
import { fileProgress } from "../../core/progress.ts";

import { PublishRecord } from "../types.ts";
import { PublishFiles } from "../provider.ts";
import { capitalize } from "../../core/text.ts";
import { gfmAutoIdentifier } from "../../core/pandoc/pandoc-id.ts";
import { randomHex } from "../../core/random.ts";
import { copyTo } from "../../core/copy.ts";
import { isHtmlContent } from "../../core/mime.ts";

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
  ) => Promise<Deploy>;
  getDeploy: (deployId: string) => Promise<Deploy>;
  uploadDeployFile: (
    deployId: string,
    path: string,
    fileBody: Blob,
  ) => Promise<void>;
}

export async function handlePublish<
  Site extends PublishSite,
  Deploy extends PublishDeploy,
>(
  handler: PublishHandler<Site, Deploy>,
  type: "document" | "site",
  title: string,
  slug: string,
  render: (siteUrl?: string) => Promise<PublishFiles>,
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
  const publishFiles = await render(target.url);

  // validate that the main document is html
  if (type === "document" && !isHtmlContent(publishFiles.rootFile)) {
    throw new Error(`Documents published to ${handler.name} must be HTML.`);
  }

  // if this is an html document that isn't index.html then
  // stage the files in a temp dir and rename the root file
  // to index.html
  const kIndex = "index.html";
  let cleanupIndex = false;
  if (type === "document" && !publishFiles.files.includes(kIndex)) {
    copyTo(
      join(publishFiles.baseDir, publishFiles.rootFile),
      join(publishFiles.baseDir, kIndex),
    );
    publishFiles.files.push(kIndex);
    publishFiles.rootFile = kIndex;
    cleanupIndex = true;
  }

  try {
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
      for (const file of publishFiles.files) {
        const filePath = publishFilePath(file);
        const sha1 = await crypto.subtle.digest(
          "SHA-1",
          Deno.readFileSync(filePath),
        );
        const encodedSha1 = hexEncode(new Uint8Array(sha1));
        files.push([file, textDecoder.decode(encodedSha1)]);
      }

      // create deploy
      const deploy = {
        files: {} as Record<string, string>,
      };
      for (const file of files) {
        deploy.files[`/${file[0]}`] = file[1];
      }
      siteDeploy = await handler.createDeploy(target!.id, deploy.files);

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

    completeMessage(`Published: ${targetUrl}\n`);

    return [
      { ...target, url: targetUrl },
      launchUrl ? new URL(launchUrl) : undefined,
    ];
  } finally {
    if (cleanupIndex) {
      const indexFile = join(publishFiles.baseDir, kIndex);
      if (existsSync(indexFile)) {
        Deno.removeSync(indexFile);
      }
    }
  }
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
      message: `${typeName(type)} name:`,
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
  return capitalize(type);
}
