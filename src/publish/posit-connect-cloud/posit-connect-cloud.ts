/*
 * posit-connect-cloud.ts
 *
 * Copyright (C) 2020-2026 Posit Software, PBC
 *
 * Publish provider for Posit Connect Cloud (connect.posit.cloud).
 * Supports static content publishing via bundle upload (Pattern B).
 * Authentication uses OAuth 2.0 Device Code flow.
 */

import { info, warning } from "../../deno_ral/log.ts";
import * as colors from "fmt/colors";

import { Select } from "cliffy/prompt/select.ts";

import {
  AccountToken,
  AccountTokenType,
  PublishFiles,
  PublishProvider,
} from "../provider-types.ts";
import { ApiError, PublishOptions, PublishRecord } from "../types.ts";
import { authorizePrompt } from "../account.ts";
import { createBundle } from "../common/bundle.ts";
import { renderForPublish } from "../common/publish.ts";
import { createTempContext } from "../../core/temp.ts";
import { completeMessage, withSpinner } from "../../core/console.ts";
import { openUrl } from "../../core/shell.ts";
import { isServerSession } from "../../core/platform.ts";
import { sleep } from "../../core/wait.ts";
import { RenderFlags } from "../../command/render/types.ts";

import {
  getEnvironment,
  getEnvironmentConfig,
  initiateDeviceAuth,
  pollForToken,
  positConnectCloudDebug as publishDebug,
  PositConnectCloudClient,
  readStoredTokens,
  writeStoredToken,
  writeStoredTokens,
} from "./api/index.ts";
import { Account, PositConnectCloudToken } from "./api/types.ts";

export const kPositConnectCloud = "posit-connect-cloud";
const kPositConnectCloudDescription = "Posit Connect Cloud";
const kPositConnectCloudAccessTokenVar = "POSIT_CONNECT_CLOUD_ACCESS_TOKEN";
const kPositConnectCloudRefreshTokenVar = "POSIT_CONNECT_CLOUD_REFRESH_TOKEN";
const kPositConnectCloudAccountIdVar = "POSIT_CONNECT_CLOUD_ACCOUNT_ID";
const kRevisionPollTimeoutMs = 30 * 60 * 1000; // 30 minutes

export const positConnectCloudProvider: PublishProvider = {
  name: kPositConnectCloud,
  description: kPositConnectCloudDescription,
  requiresServer: false,
  listOriginOnly: false,
  accountTokens,
  authorizeToken,
  removeToken,
  resolveTarget,
  publish,
  isUnauthorized,
  isNotFound,
};

function accountTokens(): Promise<AccountToken[]> {
  const accounts: AccountToken[] = [];
  const env = getEnvironmentConfig();
  const serverUrl = `https://${env.uiHost}`;

  // Check for environment variable token (CI/CD)
  // See also: POSIT_CONNECT_CLOUD_REFRESH_TOKEN, POSIT_CONNECT_CLOUD_ACCOUNT_ID
  const envToken = Deno.env.get(kPositConnectCloudAccessTokenVar);
  if (envToken) {
    accounts.push({
      type: AccountTokenType.Environment,
      name: kPositConnectCloudAccessTokenVar,
      server: serverUrl,
      token: envToken,
    });
  }

  // Check for stored tokens
  const storedTokens = readStoredTokens();
  const currentEnv = getEnvironment();
  for (const stored of storedTokens) {
    if (stored.environment === currentEnv) {
      accounts.push({
        type: AccountTokenType.Authorized,
        name: stored.accountName,
        server: serverUrl,
        token: stored.accessToken,
      });
    }
  }

  return Promise.resolve(accounts);
}

async function authorizeToken(
  _options: PublishOptions,
): Promise<AccountToken | undefined> {
  if (!await authorizePrompt(positConnectCloudProvider)) {
    return undefined;
  }

  const env = getEnvironmentConfig();
  publishDebug(
    `Starting authorization (env: ${getEnvironment()}, client_id: ${env.clientId})`,
  );

  // Step 1: Initiate device authorization
  const deviceAuth = await initiateDeviceAuth(env);

  // Step 2: Display user code and open browser
  info("");
  info(
    `  Your authorization code is: ${
      colors.bold(colors.green(deviceAuth.user_code))
    }`,
  );
  info("");

  const authUrlObj = new URL(deviceAuth.verification_uri_complete);
  authUrlObj.searchParams.set("utm_source", "quarto-cli");
  const authUrl = authUrlObj.toString();
  if (isServerSession()) {
    info(
      "  Please open this URL to authorize: " +
        colors.underline(authUrl),
    );
  } else {
    info("  Opening browser to authorize...");
    await openUrl(authUrl);
  }
  info("");

  // Step 3: Poll for token
  const tokenResponse = await pollForToken(
    env,
    deviceAuth.device_code,
    deviceAuth.interval,
    deviceAuth.expires_in,
  );

  // Step 4: Verify token and get user info (non-fatal if signup incomplete)
  const client = new PositConnectCloudClient(tokenResponse.access_token);
  try {
    const user = await client.getUser();
    publishDebug(
      `Authenticated as: ${user.display_name} (${user.email})`,
    );
  } catch (err) {
    // 401 means Connect Cloud signup incomplete — user authenticated with Posit
    // but hasn't created a Connect Cloud account yet. The account creation flow
    // in Step 6 below handles this. (rsconnect skips getUser entirely.)
    if (!(err instanceof ApiError && err.status === 401)) {
      throw err;
    }
    publishDebug("getUser returned 401 — signup may be incomplete");
  }

  // Step 5: Get accounts with publishing permissions
  let accounts: Account[];
  try {
    accounts = await client.listAccounts();
  } catch (err) {
    // 401 with "no_user_for_lucid_user" means signup incomplete
    if (err instanceof ApiError && err.status === 401) {
      accounts = [];
    } else {
      throw err;
    }
  }

  // Filter for accounts with content:create permission
  const publishableAccounts = accounts.filter((a) =>
    a.permissions?.includes("content:create")
  );

  // Step 6: Handle account selection
  let selectedAccount: Account;

  if (publishableAccounts.length === 0) {
    // Open account creation page and poll
    info("  No publishable accounts found. Opening account setup...");
    const accountUrl = client.accountCreationUrl();
    if (isServerSession()) {
      info(
        "  Please open this URL to create an account: " +
          colors.underline(accountUrl),
      );
    } else {
      await openUrl(accountUrl);
    }

    // Poll for accounts for up to 10 minutes (300 iterations * 2s)
    const kMaxAttempts = 300;
    const kPollInterval = 2000;
    let found: Account[] = [];
    await withSpinner({
      message: "Waiting for account setup",
    }, async () => {
      for (let i = 0; i < kMaxAttempts; i++) {
        await sleep(kPollInterval);
        try {
          const refreshed = await client.listAccounts();
          found = refreshed.filter((a) =>
            a.permissions?.includes("content:create")
          );
          if (found.length > 0) break;
        } catch (err) {
          publishDebug(
            `Account polling error (will retry): ${err}`,
          );
        }
      }
    });

    if (found.length === 0) {
      throw new Error(
        "Timed out waiting for account setup. Please complete account setup and try again.",
      );
    }

    selectedAccount = found[0];
  } else if (publishableAccounts.length === 1) {
    selectedAccount = publishableAccounts[0];
    publishDebug(
      `Auto-selected account: ${selectedAccount.name}`,
    );
  } else {
    // Multiple accounts - prompt user
    const selectedIdx = await Select.prompt({
      indent: "",
      message: "Select account:",
      options: publishableAccounts.map((a, i) => ({
        name: a.display_name ? `${a.display_name} (${a.name})` : a.name,
        value: String(i),
      })),
    });
    selectedAccount = publishableAccounts[Number(selectedIdx)];
  }

  info(
    `  Authorized to publish as ${
      colors.bold(selectedAccount.display_name || selectedAccount.name)
    }`,
  );

  // Step 7: Store token
  const storedToken: PositConnectCloudToken = {
    username: selectedAccount.display_name || selectedAccount.name,
    accountId: selectedAccount.id,
    accountName: selectedAccount.name,
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    expiresAt: Date.now() + (tokenResponse.expires_in * 1000),
    environment: getEnvironment(),
  };
  writeStoredToken(storedToken);
  publishDebug("Token stored");

  return {
    type: AccountTokenType.Authorized,
    name: selectedAccount.name,
    server: `https://${env.uiHost}`,
    token: tokenResponse.access_token,
  };
}

function removeToken(token: AccountToken) {
  const currentEnv = getEnvironment();
  const tokens = readStoredTokens().filter(
    (stored) =>
      !(stored.accountName === token.name && stored.environment === currentEnv),
  );
  writeStoredTokens(tokens);
}

async function resolveTarget(
  account: AccountToken,
  target: PublishRecord,
): Promise<PublishRecord | undefined> {
  const client = clientForAccount(account);
  try {
    const content = await client.getContent(target.id);
    if (content.state === "deleted") {
      publishDebug(
        `Content ${target.id} is deleted, treating as not found`,
      );
      return undefined;
    }
    return {
      id: content.id,
      url: target.url,
      code: false,
    };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return undefined;
    }
    throw err;
  }
}

async function publish(
  account: AccountToken,
  type: "document" | "site",
  _input: string,
  title: string,
  _slug: string,
  render: (flags?: RenderFlags) => Promise<PublishFiles>,
  options: PublishOptions,
  target?: PublishRecord,
): Promise<[PublishRecord, URL | undefined]> {
  // --token is not supported: Connect Cloud uses short-lived OAuth tokens,
  // not permanent API keys. CI/CD should use environment variables instead.
  if (options.token) {
    throw new Error(
      "Posit Connect Cloud does not support --token. " +
        "For CI/CD, use environment variables: " +
        "POSIT_CONNECT_CLOUD_ACCESS_TOKEN, " +
        "POSIT_CONNECT_CLOUD_REFRESH_TOKEN, and " +
        "POSIT_CONNECT_CLOUD_ACCOUNT_ID.",
    );
  }

  const storedToken = findStoredToken(account);
  const client = clientForAccount(account, storedToken);
  let accountName = storedToken?.accountName || account.name;
  let accountId = storedToken?.accountId || "";

  // For environment tokens (CI/CD), resolve account via API.
  // Honors POSIT_CONNECT_CLOUD_ACCOUNT_ID env var to select a specific account;
  // without it, auto-selects the first publishable account.
  if (!storedToken && account.type === AccountTokenType.Environment) {
    publishDebug(
      "Resolving account for environment token",
    );
    const accounts = await client.listAccounts();
    const publishable = accounts.filter((a) =>
      a.permissions?.includes("content:create")
    );
    if (publishable.length === 0) {
      throw new Error(
        "No publishable accounts found for the provided access token.",
      );
    }
    const envAccountId = Deno.env.get(kPositConnectCloudAccountIdVar);
    if (envAccountId) {
      const match = publishable.find((a) => a.id === envAccountId);
      if (!match) {
        throw new Error(
          `Account ${envAccountId} not found or lacks content:create permission.`,
        );
      }
      accountName = match.name;
      accountId = match.id;
    } else {
      accountName = publishable[0].name;
      accountId = publishable[0].id;
      if (publishable.length > 1) {
        warning(
          `Multiple publishable accounts found. Using "${accountName}". ` +
            `Set ${kPositConnectCloudAccountIdVar} to select a specific account.`,
        );
      }
    }
    publishDebug(
      `Resolved account: ${accountName} (${accountId})`,
    );
  }

  // Step 1: Prepare - create or update content
  const { contentId, revisionId, uploadUrl } = await withSpinner({
    message: `Preparing to publish ${type}`,
  }, async () => {
    if (!target) {
      // Guard: accountId is required for content creation
      if (!accountId?.trim()) {
        throw new Error(
          "Account ID not found. Please re-authorize with " +
            "'quarto publish posit-connect-cloud --authorize'.",
        );
      }
      // New content
      publishDebug("Creating new content");
      const content = await client.createContent(
        accountId,
        title,
        "index.html",
      );
      if (!content.next_revision?.source_bundle_upload_url) {
        throw new Error(
          "Content creation did not return an upload URL",
        );
      }
      publishDebug(
        `Content created: ${content.id}`,
      );
      return {
        contentId: content.id,
        revisionId: content.next_revision.id,
        uploadUrl: content.next_revision.source_bundle_upload_url,
      };
    } else {
      // Existing content - check if first publish or update
      const content = await client.getContent(target.id);

      if (content.state === "deleted") {
        throw new Error(
          "Content has been deleted on Connect Cloud. " +
            "Remove the publish record from _publish.yml and try again.",
        );
      }

      if (content.current_revision === null) {
        // First publish after creation - use existing next_revision
        publishDebug(
          "First publish (no current_revision), using existing next_revision",
        );
        if (!content.next_revision?.source_bundle_upload_url) {
          throw new Error(
            "Content has no upload URL in next_revision",
          );
        }
        return {
          contentId: content.id,
          revisionId: content.next_revision.id,
          uploadUrl: content.next_revision.source_bundle_upload_url,
        };
      } else {
        // Subsequent publish - PATCH to create new revision
        publishDebug("Updating existing content");
        const updated = await client.updateContent(
          content.id,
          "index.html",
        );
        if (!updated.next_revision?.source_bundle_upload_url) {
          throw new Error(
            "Content update did not return an upload URL",
          );
        }
        return {
          contentId: content.id,
          revisionId: updated.next_revision.id,
          uploadUrl: updated.next_revision.source_bundle_upload_url,
        };
      }
    }
  });
  info("");

  // Step 2: Render and stage
  const publishFiles = await renderForPublish(
    render,
    kPositConnectCloud,
    type,
    title,
  );

  // Step 3: Bundle and upload
  const tempContext = createTempContext();
  try {
    await withSpinner({
      message: () => "Uploading files",
    }, async () => {
      const { bundlePath } = await createBundle(
        type,
        publishFiles,
        tempContext,
      );
      const bundleBytes = await Deno.readFile(bundlePath);
      publishDebug(
        `Bundle: ${publishFiles.files.length} files, ${bundleBytes.length} bytes compressed`,
      );
      await client.uploadBundle(uploadUrl, bundleBytes);
    });

    // Step 4: Publish and poll
    await withSpinner({
      message: `Publishing ${type}`,
    }, async () => {
      await client.publishContent(contentId);

      // Poll revision status
      const pollStartTime = Date.now();
      let lastStatus = "";
      while (true) {
        if (Date.now() - pollStartTime > kRevisionPollTimeoutMs) {
          throw new Error(
            "Timed out waiting for publish to complete. " +
              "Check the Connect Cloud dashboard for status.",
          );
        }

        const revision = await client.getRevision(revisionId);

        // Log status changes
        if (revision.status && revision.status !== lastStatus) {
          publishDebug(
            `Revision status: ${revision.status}`,
          );
          lastStatus = revision.status;
        }

        if (revision.publish_result === "success") {
          break;
        } else if (revision.publish_result === "failure") {
          const errorMsg = revision.publish_error_details ||
            revision.publish_error || "Unknown publish error";
          throw new Error(`Publish failed: ${errorMsg}`);
        } else if (revision.publish_result !== null) {
          throw new Error(
            `Unexpected publish result: ${revision.publish_result}`,
          );
        }

        await sleep(1000);
      }
    });

    // Build the content URL
    const contentUrl = client.contentUrl(accountName, contentId);
    completeMessage(`Published: ${contentUrl}\n`);

    const publishRecord: PublishRecord = {
      id: contentId,
      url: contentUrl,
      code: false,
    };
    return [publishRecord, new URL(contentUrl)];
  } finally {
    tempContext.cleanup();
  }
}

function isUnauthorized(err: Error): boolean {
  return err instanceof ApiError && err.status === 401;
}

function isNotFound(err: Error): boolean {
  return err instanceof ApiError && err.status === 404;
}

// --- Helpers ---

function clientForAccount(
  account: AccountToken,
  storedToken?: PositConnectCloudToken,
): PositConnectCloudClient {
  const token = storedToken ?? findStoredToken(account);

  // For environment tokens, check for optional refresh token
  if (account.type === AccountTokenType.Environment) {
    const refreshToken = Deno.env.get(kPositConnectCloudRefreshTokenVar);
    if (refreshToken) {
      const pseudoToken: PositConnectCloudToken = {
        username: account.name,
        accountId: "",
        accountName: account.name,
        accessToken: account.token,
        refreshToken,
        expiresAt: 0, // Unknown for env tokens; rely on reactive refresh
        environment: getEnvironment(),
      };
      return new PositConnectCloudClient(account.token, pseudoToken);
    }
    return new PositConnectCloudClient(account.token);
  }

  return new PositConnectCloudClient(account.token, token);
}

function findStoredToken(
  account: AccountToken,
): PositConnectCloudToken | undefined {
  const currentEnv = getEnvironment();
  return readStoredTokens().find(
    (t) => t.accountName === account.name && t.environment === currentEnv,
  );
}
