/*
* publish.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { info } from "log/mod.ts";

import { walkSync } from "fs/mod.ts";
import { join, relative } from "path/mod.ts";
import { crypto } from "crypto/mod.ts";
import { encode as hexEncode } from "encoding/hex.ts";

import { sleep } from "../../core/wait.ts";
import { completeMessage, withSpinner } from "../../core/console.ts";
import { fileProgress } from "../../core/progress.ts";

import { PublishRecord } from "../types.ts";

export interface PublishSite {
  id?: string;
  url?: string;
}

export interface PublishDeploy {
  id?: string;
  state?: string;
  required?: string[];
  admin_url?: string;
}

export interface PublishHandler<
  Site extends PublishSite = PublishSite,
  Deploy extends PublishDeploy = PublishDeploy,
> {
  name: string;
  createSite: () => Promise<Site>;
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

export async function publishSite<
  Site extends PublishSite,
  Deploy extends PublishDeploy,
>(
  handler: PublishHandler<Site, Deploy>,
  render: (siteDir: string) => Promise<string>,
  target?: PublishRecord,
): Promise<[PublishRecord, URL]> {
  // determine target (create new site if necessary)
  info("");
  if (!target?.id) {
    await withSpinner({
      message: `Creating ${handler.name} site`,
    }, async () => {
      const site = await handler.createSite();
      target = {
        id: site.id!,
        url: site.url!,
      };
    });
    info("");
  }
  target = target!;

  // render
  const outputDir = await render(target.url);

  // build file list
  let siteDeploy: Deploy | undefined;
  const files: Array<[string, string]> = [];
  await withSpinner({
    message: "Preparing to publish site",
  }, async () => {
    const textDecoder = new TextDecoder();
    for (const walk of walkSync(outputDir)) {
      if (walk.isFile) {
        const path = relative(outputDir, walk.path);
        const sha1 = await crypto.subtle.digest(
          "SHA-1",
          Deno.readFileSync(walk.path),
        );
        const encodedSha1 = hexEncode(new Uint8Array(sha1));
        files.push([path, textDecoder.decode(encodedSha1)]);
      }
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
      if (siteDeploy.state === "prepared") {
        if (!siteDeploy.required) {
          throw new Error(
            "Site deploy prepared but no required files provided",
          );
        }
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
      const filePath = join(outputDir, requiredFile);
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
  let adminUrl = target.url;
  await withSpinner({
    message: "Deploying published site",
  }, async () => {
    while (true) {
      const deployReady = await handler.getDeploy(siteDeploy?.id!);
      if (deployReady.state === "ready") {
        adminUrl = deployReady.admin_url || adminUrl;
        break;
      }
      await sleep(500);
    }
  });

  completeMessage(`Published: ${target.url}\n`);

  return [target, new URL(adminUrl)];
}
