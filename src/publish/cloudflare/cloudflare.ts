/*
 * cloudflare.ts
 *
 * Copyright (C) 2020-2024 Posit Software, PBC
 */

import { Input } from "cliffy/prompt/input.ts";

import {
  AccountToken,
  PublishFiles,
  PublishProvider,
} from "../provider-types.ts";
import { PublishOptions, PublishRecord } from "../types.ts";
import { renderForPublish } from "../common/publish.ts";
import { RenderFlags } from "../../command/render/types.ts";
import { execProcess } from "../../core/process.ts";
import { anonymousAccount } from "../common/git.ts";

export const kCloudflarePages = "cloudflare-pages";
const kCloudflarePagesDescription = "Cloudflare Pages";

const kDefaultProductionBranch = "main";

export const cloudflarePagesProvider: PublishProvider = {
  name: kCloudflarePages,
  description: kCloudflarePagesDescription,
  requiresServer: false,
  listOriginOnly: false,
  accountTokens: () => Promise.resolve([anonymousAccount()]),
  authorizeToken: () => Promise.resolve(anonymousAccount()),
  removeToken: () => {},
  resolveTarget: (_account: AccountToken, target: PublishRecord) =>
    Promise.resolve(target),
  publish,
  isUnauthorized: () => false,
  isNotFound: () => false,
};

async function publish(
  _account: AccountToken,
  type: "document" | "site",
  _input: string,
  title: string,
  slug: string,
  render: (flags?: RenderFlags) => Promise<PublishFiles>,
  options: PublishOptions,
  target?: PublishRecord,
): Promise<[PublishRecord, URL | undefined]> {
  const publishFiles = await renderForPublish(
    render,
    kCloudflarePages,
    type,
    title,
    type === "site" ? target?.url : undefined,
  );

  let projectName = target?.id || slug;
  if (!target?.id && options.prompt) {
    projectName = await promptForProjectName(projectName);
  }

  await deployWithWrangler(
    publishFiles.baseDir,
    projectName,
    kDefaultProductionBranch,
  );

  const url = defaultProjectUrl(projectName);

  return [
    {
      id: projectName,
      url,
    },
    url ? new URL(url) : undefined,
  ];
}

async function promptForProjectName(defaultSlug: string): Promise<string> {
  return await Input.prompt({
    message: "Cloudflare Pages project name:",
    default: defaultSlug,
    validate: (value) => {
      if (value.length === 0) {
        throw new Error();
      }
      return true;
    },
  });
}

function defaultProjectUrl(projectName: string) {
  return `https://${projectName}.pages.dev`;
}

let wranglerChecked = false;

async function ensureWrangler() {
  if (wranglerChecked) {
    return;
  }
  try {
    const result = await execProcess({
      cmd: "wrangler",
      args: ["--version"],
      stdout: "null",
      stderr: "null",
    });
    if (!result.success) {
      throw new Error();
    }
    wranglerChecked = true;
  } catch {
    throw new Error(
      "Cloudflare Pages publishing requires the Wrangler CLI (https://developers.cloudflare.com/workers/wrangler/install/).",
    );
  }
}

async function deployWithWrangler(
  dir: string,
  projectName: string,
  productionBranch: string,
) {
  await ensureWrangler();

  const result = await execProcess({
    cmd: "wrangler",
    args: [
      "pages",
      "deploy",
      dir,
      "--project-name",
      projectName,
      "--branch",
      productionBranch,
    ],
    stdout: "inherit",
    stderr: "inherit",
  });

  if (!result.success) {
    throw new Error(
      "Cloudflare Pages deployment failed. See the Wrangler output above for details.",
    );
  }
}
