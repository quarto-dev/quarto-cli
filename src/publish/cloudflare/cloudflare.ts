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
  );

  const deploymentUrl = await deploymentUrlFromWrangler(projectName);
  const recordUrl = target?.url ??
    (deploymentUrl
      ? canonicalUrlFromDeployment(deploymentUrl) || deploymentUrl
      : defaultProjectUrl(projectName));
  const openUrl = target?.url ?? deploymentUrl ?? recordUrl;

  return [
    {
      id: projectName,
      url: recordUrl,
    },
    openUrl ? new URL(openUrl) : undefined,
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

type WranglerDeployment = {
  Deployment?: string;
  deployment?: string;
  Branch?: string;
  branch?: string;
};

async function deploymentUrlFromWrangler(
  projectName: string,
): Promise<string | undefined> {
  try {
    const result = await execProcess({
      cmd: "wrangler",
      args: [
        "pages",
        "deployment",
        "list",
        "--project-name",
        projectName,
        "--json",
      ],
      stdout: "piped",
      stderr: "piped",
    });
    if (!result.success || !result.stdout.trim()) {
      return undefined;
    }
    const deployments = JSON.parse(result.stdout) as WranglerDeployment[];
    if (!Array.isArray(deployments) || deployments.length === 0) {
      return undefined;
    }
    for (const deployment of deployments) {
      const url = deployment.Deployment || deployment.deployment;
      if (url) {
        return url;
      }
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function canonicalUrlFromDeployment(
  deploymentUrl: string,
): string | undefined {
  try {
    const url = new URL(deploymentUrl);
    const host = url.hostname.toLowerCase();
    if (host.endsWith(".pages.dev")) {
      const parts = host.split(".");
      if (parts.length >= 4) {
        return `${url.protocol}//${parts.slice(1).join(".")}`;
      }
    }
  } catch {
    return undefined;
  }
}
