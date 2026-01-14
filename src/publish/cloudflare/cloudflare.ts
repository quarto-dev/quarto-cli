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
import { sleep } from "../../core/wait.ts";

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

  if (!options.prompt) {
    await ensureProjectExists(projectName);
  }

  await deployWithWrangler(
    publishFiles.baseDir,
    projectName,
  );

  const deploymentUrl = await deploymentUrlFromWrangler(projectName);
  const recordUrl = target?.url ??
    (deploymentUrl
      ? canonicalUrlFromDeployment(deploymentUrl, projectName) || deploymentUrl
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
type WranglerCommand = {
  cmd: string;
  args: string[];
};
let wranglerCommand: WranglerCommand | undefined;

async function ensureWrangler() {
  if (wranglerChecked) {
    return;
  }
  await resolveWranglerCommand();
  wranglerChecked = true;
}

async function deployWithWrangler(
  dir: string,
  projectName: string,
) {
  await ensureWrangler();

  const result = await execWrangler([
    "pages",
    "deploy",
    dir,
    "--project-name",
    projectName,
  ], {
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

const kDeploymentLookupRetries = 3;
const kDeploymentLookupDelay = 500;

async function ensureProjectExists(projectName: string) {
  const result = await execWrangler([
    "pages",
    "deployment",
    "list",
    "--project-name",
    projectName,
    "--json",
  ], {
    stdout: "piped",
    stderr: "piped",
  });
  if (!result.success) {
    throw new Error(
      `Unable to access Cloudflare Pages project '${projectName}'. Ensure Wrangler is authenticated (wrangler login or CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_API_TOKEN) and the project exists. Create it first with 'wrangler pages project create ${projectName} --production-branch <branch>' or run without --no-prompt.`,
    );
  }
}

async function deploymentUrlFromWrangler(
  projectName: string,
): Promise<string | undefined> {
  for (let attempt = 0; attempt < kDeploymentLookupRetries; attempt++) {
    const url = await tryDeploymentUrlFromWrangler(projectName);
    if (url) {
      return url;
    }
    if (attempt < kDeploymentLookupRetries - 1) {
      await sleep(kDeploymentLookupDelay);
    }
  }
  return undefined;
}

async function tryDeploymentUrlFromWrangler(
  projectName: string,
): Promise<string | undefined> {
  try {
    const result = await execWrangler([
      "pages",
      "deployment",
      "list",
      "--project-name",
      projectName,
      "--json",
    ], {
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
  projectName: string,
): string | undefined {
  try {
    const url = new URL(deploymentUrl);
    const host = url.hostname.toLowerCase();
    if (host.endsWith(".pages.dev")) {
      const parts = host.split(".");
      if (parts.length >= 4) {
        const project = parts[1];
        const prefix = parts[0];
        if (project !== projectName.toLowerCase()) {
          return undefined;
        }
        if (!/^[0-9a-f]{6,}$/i.test(prefix)) {
          return undefined;
        }
        return `${url.protocol}//${parts.slice(1).join(".")}`;
      }
    }
  } catch {
    return undefined;
  }
}

async function resolveWranglerCommand(): Promise<WranglerCommand> {
  if (wranglerCommand) {
    return wranglerCommand;
  }
  const wranglerResult = await execProcess({
    cmd: "wrangler",
    args: ["--version"],
    stdout: "null",
    stderr: "null",
  });
  if (wranglerResult.success) {
    wranglerCommand = { cmd: "wrangler", args: [] };
    return wranglerCommand;
  }

  const npxResult = await execProcess({
    cmd: "npx",
    args: ["wrangler", "--version"],
    stdout: "null",
    stderr: "null",
  });
  if (npxResult.success) {
    wranglerCommand = { cmd: "npx", args: ["wrangler"] };
    return wranglerCommand;
  }

  throw new Error(
    "Cloudflare Pages publishing requires the Wrangler CLI (https://developers.cloudflare.com/workers/wrangler/install/). You can also run via npx if Wrangler is installed locally.",
  );
}

async function execWrangler(
  args: string[],
  options: Deno.CommandOptions = {},
) {
  const command = await resolveWranglerCommand();
  return await execProcess({
    cmd: command.cmd,
    ...options,
    args: [...command.args, ...args],
  });
}
