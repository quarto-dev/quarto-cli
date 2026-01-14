/*
 * cloudflare.ts
 *
 * Copyright (C) 2020-2024 Posit Software, PBC
 */

import { info } from "../../deno_ral/log.ts";
import * as colors from "fmt/colors";

import { Input } from "cliffy/prompt/input.ts";
import { Secret } from "cliffy/prompt/secret.ts";
import { prompt, Select } from "cliffy/prompt/mod.ts";

import {
  AccountToken,
  AccountTokenType,
  PublishFiles,
  PublishProvider,
} from "../provider-types.ts";
import { ApiError, PublishOptions, PublishRecord } from "../types.ts";
import { renderForPublish } from "../common/publish.ts";
import { RenderFlags } from "../../command/render/types.ts";
import {
  readAccessTokens,
  writeAccessToken,
  writeAccessTokens,
} from "../common/account.ts";
import { execProcess } from "../../core/process.ts";

export const kCloudflarePages = "cloudflare-pages";
const kCloudflarePagesDescription = "Cloudflare Pages";

export const kCloudflareApiTokenVar = "CLOUDFLARE_API_TOKEN";
export const kCloudflareAccountIdVar = "CLOUDFLARE_ACCOUNT_ID";

const kCloudflareApiBase = "https://api.cloudflare.com/client/v4";
const kDefaultProductionBranch = "main";

export const cloudflarePagesProvider: PublishProvider = {
  name: kCloudflarePages,
  description: kCloudflarePagesDescription,
  requiresServer: true,
  listOriginOnly: false,
  filterAccountsByServer: false,
  accountDescriptor: "Cloudflare account",
  accountTokens,
  authorizeToken,
  removeToken,
  resolveTarget,
  publish,
  isUnauthorized,
  isNotFound,
};

type CloudflareAccount = {
  accountId: string;
  accountName: string;
  token: string;
};

type CloudflareApiError = {
  code: number;
  message: string;
};

type CloudflareApiResponse<T> = {
  success: boolean;
  errors?: CloudflareApiError[];
  result: T;
};

type CloudflareProject = {
  id: string;
  name: string;
  subdomain?: string;
  domains?: string[];
  production_branch?: string;
};

function accountTokens() {
  const accounts: AccountToken[] = [];

  const envToken = Deno.env.get(kCloudflareApiTokenVar);
  const envAccountId = Deno.env.get(kCloudflareAccountIdVar);
  if (envToken && envAccountId) {
    accounts.push({
      type: AccountTokenType.Environment,
      name: kCloudflareApiTokenVar,
      server: envAccountId,
      token: envToken,
    });
  }

  const tokens = readAccessTokens<CloudflareAccount>(kCloudflarePages);
  if (tokens) {
    accounts.push(
      ...tokens.map((token) => ({
        type: AccountTokenType.Authorized,
        name: token.accountName || token.accountId,
        server: token.accountId,
        token: token.token,
      })),
    );
  }

  return Promise.resolve(accounts);
}

function removeToken(token: AccountToken) {
  writeAccessTokens(
    cloudflarePagesProvider.name,
    readAccessTokens<CloudflareAccount>(cloudflarePagesProvider.name)?.filter(
      (accessToken) => {
        return accessToken.accountId !== token.server ||
          accessToken.accountName !== token.name;
      },
    ) || [],
  );
}

async function authorizeToken(
  options: PublishOptions,
): Promise<AccountToken | undefined> {
  let accountId = options.server || undefined;
  while (true) {
    if (!accountId) {
      accountId = await Input.prompt({
        message: "Cloudflare account ID:",
        hint: "Find this in your Cloudflare dashboard account settings.",
        validate: (value) => {
          if (value.length === 0) {
            throw new Error();
          }
          return true;
        },
      });
    }

    const apiToken = await Secret.prompt({
      message: "Cloudflare API token:",
      hint: "Create a token with Pages permissions in your Cloudflare dashboard.",
    });
    if (apiToken.length === 0) {
      throw new Error();
    }

    try {
      await listProjects(accountId, apiToken);
      const account: CloudflareAccount = {
        accountId,
        accountName: accountId,
        token: apiToken,
      };
      writeAccessToken(
        kCloudflarePages,
        account,
        (a, b) => a.accountId === b.accountId,
      );
      return {
        type: AccountTokenType.Authorized,
        name: account.accountName,
        server: account.accountId,
        token: account.token,
      };
    } catch (err) {
      if (!(err instanceof Error)) {
        throw err;
      }
      if (isUnauthorized(err)) {
        promptError("Unable to authenticate with the provided token.");
      } else {
        promptError(
          "Unable to access Cloudflare Pages with this account ID and token.",
        );
      }
      accountId = undefined;
    }
  }
}

async function resolveTarget(
  account: AccountToken,
  target: PublishRecord,
): Promise<PublishRecord | undefined> {
  const accountId = account.server;
  if (!accountId) {
    throw new Error(
      "Cloudflare account ID is required (set CLOUDFLARE_ACCOUNT_ID or use --server).",
    );
  }

  const project = await getProject(accountId, account.token, target.id);
  target.url = projectUrl(project);
  return target;
}

async function publish(
  account: AccountToken,
  type: "document" | "site",
  _input: string,
  title: string,
  slug: string,
  render: (flags?: RenderFlags) => Promise<PublishFiles>,
  options: PublishOptions,
  target?: PublishRecord,
): Promise<[PublishRecord, URL | undefined]> {
  const accountId = account.server || options.server ||
    Deno.env.get(kCloudflareAccountIdVar);
  if (!accountId) {
    throw new Error(
      "Cloudflare account ID is required (set CLOUDFLARE_ACCOUNT_ID or use --server).",
    );
  }

  const publishFiles = await renderForPublish(
    render,
    kCloudflarePages,
    type,
    title,
    type === "site" ? target?.url : undefined,
  );

  let project: CloudflareProject | undefined;
  if (target?.id) {
    project = await getProject(accountId, account.token, target.id);
  } else if (options.prompt) {
    project = await chooseProject(accountId, account.token, slug);
  } else {
    project = await createProjectWithRetry(
      accountId,
      account.token,
      slug,
      options.prompt,
    );
  }

  const projectName = project?.name || target?.id || slug;
  const productionBranch = project?.production_branch ||
    kDefaultProductionBranch;

  await deployWithWrangler(
    publishFiles.baseDir,
    projectName,
    productionBranch,
    accountId,
    account.token,
  );

  const url = project ? projectUrl(project) : defaultProjectUrl(projectName);

  return [
    {
      id: projectName,
      url,
    },
    url ? new URL(url) : undefined,
  ];
}

function promptError(message: string) {
  info(colors.red(`  ${message}`));
}

async function chooseProject(
  accountId: string,
  token: string,
  defaultSlug: string,
): Promise<CloudflareProject> {
  const projects = await listProjects(accountId, token);
  if (projects.length > 0) {
    const kCreateNew = "__create__";
    const result = await prompt([{
      name: "project",
      message: "Cloudflare Pages project:",
      type: Select,
      options: [
        ...projects.map((project) => ({
          name: projectLabel(project),
          value: project.name,
        })),
        {
          name: "Create a new project...",
          value: kCreateNew,
        },
      ],
    }]);

    if (result.project && result.project !== kCreateNew) {
      const existing = projects.find((project) => project.name === result.project);
      if (existing) {
        return existing;
      }
    }
  }

  const projectName = await promptForProjectName(defaultSlug);
  return await createProjectWithRetry(accountId, token, projectName, true);
}

async function promptForProjectName(defaultSlug: string): Promise<string> {
  return await Input.prompt({
    message: "Project name:",
    default: defaultSlug,
    validate: (value) => {
      if (value.length === 0) {
        throw new Error();
      }
      return true;
    },
  });
}

async function createProjectWithRetry(
  accountId: string,
  token: string,
  projectName: string,
  allowPrompt: boolean,
): Promise<CloudflareProject> {
  while (true) {
    try {
      return await createProject(
        accountId,
        token,
        projectName,
        kDefaultProductionBranch,
      );
    } catch (err) {
      if (!(err instanceof Error)) {
        throw err;
      }
      if (!isConflict(err)) {
        throw err;
      }
      if (!allowPrompt) {
        throw new Error(
          `A Cloudflare Pages project named '${projectName}' already exists. Use --id to target it or run with prompts enabled.`,
        );
      }
      promptError(
        `A Cloudflare Pages project named '${projectName}' already exists.`,
      );
      projectName = await promptForProjectName(projectName);
    }
  }
}

function projectLabel(project: CloudflareProject) {
  const url = projectUrl(project);
  return url ? `${project.name} (${url})` : project.name;
}

function projectUrl(project: CloudflareProject) {
  if (project.domains && project.domains.length > 0) {
    return `https://${project.domains[0]}`;
  }

  if (project.subdomain) {
    if (project.subdomain.includes(".")) {
      return `https://${project.subdomain}`;
    }
    return `https://${project.subdomain}.pages.dev`;
  }

  return defaultProjectUrl(project.name);
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
  accountId: string,
  token: string,
) {
  await ensureWrangler();

  const env = {
    [kCloudflareApiTokenVar]: token,
    [kCloudflareAccountIdVar]: accountId,
  };

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
    env,
    stdout: "inherit",
    stderr: "inherit",
  });

  if (!result.success) {
    throw new Error(
      "Cloudflare Pages deployment failed. See the Wrangler output above for details.",
    );
  }
}

async function listProjects(accountId: string, token: string) {
  return await cloudflareRequest<CloudflareProject[]>(
    token,
    `/accounts/${encodeURIComponent(accountId)}/pages/projects`,
  );
}

async function getProject(
  accountId: string,
  token: string,
  projectName: string,
) {
  return await cloudflareRequest<CloudflareProject>(
    token,
    `/accounts/${encodeURIComponent(accountId)}/pages/projects/${encodeURIComponent(projectName)}`,
  );
}

async function createProject(
  accountId: string,
  token: string,
  projectName: string,
  productionBranch: string,
) {
  return await cloudflareRequest<CloudflareProject>(
    token,
    `/accounts/${encodeURIComponent(accountId)}/pages/projects`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: projectName,
        production_branch: productionBranch,
      }),
    },
  );
}

async function cloudflareRequest<T>(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${kCloudflareApiBase}${path}`, {
    ...init,
    headers,
  });

  let payload: CloudflareApiResponse<T> | undefined;
  try {
    payload = await response.json();
  } catch (_err) {
    throw new ApiError(
      response.status,
      response.statusText,
      "Cloudflare API returned an invalid response",
    );
  }

  if (!response.ok || !payload?.success) {
    const message = payload?.errors?.[0]?.message;
    throw new ApiError(response.status, response.statusText, message);
  }

  return payload.result;
}

function isUnauthorized(err: Error) {
  return err instanceof ApiError && (err.status === 401 || err.status === 403);
}

function isNotFound(err: Error) {
  return err instanceof ApiError && err.status === 404;
}

function isConflict(err: Error) {
  return err instanceof ApiError && err.status === 409;
}
