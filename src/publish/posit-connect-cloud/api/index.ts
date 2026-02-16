/*
 * index.ts
 *
 * Copyright (C) 2020-2026 Posit Software, PBC
 *
 * API client for Posit Connect Cloud. Handles OAuth Device Code flow
 * authentication and all Connect Cloud API operations.
 */

import { debug } from "../../../deno_ral/log.ts";
import { sleep } from "../../../core/wait.ts";
import { quartoConfig } from "../../../core/quarto.ts";
import { ApiError } from "../../types.ts";

import {
  Account,
  Content,
  DeviceAuthResponse,
  EnvironmentConfig,
  PaginatedResponse,
  PositConnectCloudEnvironment,
  PositConnectCloudToken,
  Revision,
  TokenResponse,
  User,
} from "./types.ts";

import {
  readAccessTokens,
  writeAccessToken,
  writeAccessTokens,
} from "../../common/account.ts";

const kProviderName = "posit-connect-cloud";

// Connect Cloud OAuth scope granting access to the Connect Cloud (Vivid) API
const kOAuthScope = "vivid";

const publishDebug = (msg: string) =>
  debug(`[publish][posit-connect-cloud] ${msg}`);
export { publishDebug as positConnectCloudDebug };

const kEnvironments: Record<PositConnectCloudEnvironment, EnvironmentConfig> = {
  production: {
    authHost: "login.posit.cloud",
    apiHost: "api.connect.posit.cloud",
    uiHost: "connect.posit.cloud",
    clientId: "quarto-cli",
  },
  staging: {
    authHost: "login.staging.posit.cloud",
    apiHost: "api.staging.connect.posit.cloud",
    uiHost: "staging.connect.posit.cloud",
    clientId: "quarto-cli-staging",
  },
  development: {
    authHost: "login.staging.posit.cloud",
    apiHost: "api.dev.connect.posit.cloud",
    uiHost: "dev.connect.posit.cloud",
    clientId: "quarto-cli-staging",
  },
};

export function getEnvironment(): PositConnectCloudEnvironment {
  const env = Deno.env.get("POSIT_CONNECT_CLOUD_ENVIRONMENT");
  if (env === "staging" || env === "development" || env === "production") {
    return env;
  }
  return "production";
}

export function getEnvironmentConfig(): EnvironmentConfig {
  return kEnvironments[getEnvironment()];
}

// Proactive refresh threshold: 5 minutes before expiry
const kRefreshThresholdMs = 5 * 60 * 1000;

export class PositConnectCloudClient {
  private env_: EnvironmentConfig;
  private accessToken_: string;
  private storedToken_: PositConnectCloudToken | undefined;

  constructor(
    accessToken: string,
    storedToken?: PositConnectCloudToken,
  ) {
    this.env_ = getEnvironmentConfig();
    this.accessToken_ = accessToken;
    this.storedToken_ = storedToken;
    publishDebug(
      `Client created for ${this.env_.apiHost}`,
    );
  }

  // --- API Methods ---

  public async getUser(): Promise<User> {
    return await this.apiGet<User>("users/me");
  }

  // Single-page fetch is sufficient: Connect Cloud limits accounts per user
  // (typically 1-3), and has_user_role=true further restricts the result set.
  public async listAccounts(): Promise<Account[]> {
    const response = await this.apiGet<PaginatedResponse<Account>>(
      "accounts?has_user_role=true",
    );
    return response.data;
  }

  public async createContent(
    accountId: string,
    title: string,
    primaryFile: string,
  ): Promise<Content> {
    const body = {
      account_id: accountId,
      title,
      next_revision: {
        source_type: "bundle",
        content_type: "static",
        app_mode: "static",
        primary_file: primaryFile,
      },
      secrets: [],
    };
    publishDebug(
      `POST /contents (title: ${title}, account: ${accountId})`,
    );
    return await this.apiPost<Content>("contents", body);
  }

  public async getContent(contentId: string): Promise<Content> {
    return await this.apiGet<Content>(`contents/${contentId}`);
  }

  public async updateContent(
    contentId: string,
    primaryFile: string,
  ): Promise<Content> {
    const body = {
      secrets: [],
      revision_overrides: {
        primary_file: primaryFile,
        app_mode: "static",
      },
    };
    publishDebug(
      `PATCH /contents/${contentId}?new_bundle=true`,
    );
    return await this.apiFetch<Content>(
      "PATCH",
      `contents/${contentId}?new_bundle=true`,
      body,
    );
  }

  public async uploadBundle(uploadUrl: string, bundleData: Uint8Array) {
    publishDebug(
      `Uploading bundle (${bundleData.length} bytes)`,
    );
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/gzip",
      },
      body: bundleData,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new ApiError(
        response.status,
        response.statusText,
        text || undefined,
      );
    }
    publishDebug("Bundle uploaded successfully");
  }

  public async publishContent(contentId: string) {
    publishDebug(`POST /contents/${contentId}/publish`);
    const url = this.buildUrl_(`contents/${contentId}/publish`);
    const response = await this.fetchWithRetry_("POST", url, {
      "Accept": "application/json",
    }, undefined);
    // Drain response body to release the connection (no useful payload)
    await response.arrayBuffer();
  }

  public async getRevision(revisionId: string): Promise<Revision> {
    return await this.apiGet<Revision>(`revisions/${revisionId}`);
  }

  private buildUrl_(path: string): string {
    return `https://${this.env_.apiHost}/v1/${path}`;
  }

  public contentUrl(accountName: string, contentId: string): string {
    return `https://${this.env_.uiHost}/${accountName}/content/${contentId}`;
  }

  public accountCreationUrl(): string {
    return `https://${this.env_.uiHost}/account/done?utm_source=quarto-cli`;
  }

  // --- Token Refresh ---

  private async ensureValidToken_() {
    if (!this.storedToken_) return;
    if (this.storedToken_.expiresAt === 0) return; // Unknown expiry (env tokens)
    const now = Date.now();
    if (now >= this.storedToken_.expiresAt - kRefreshThresholdMs) {
      publishDebug(
        "Token refresh: proactive (expires soon)",
      );
      await this.tryRefreshToken_();
    }
  }

  private async tryRefreshToken_(): Promise<boolean> {
    if (!this.storedToken_?.refreshToken) return false;
    try {
      const tokenResponse = await refreshAccessToken(
        this.env_,
        this.storedToken_.refreshToken,
      );
      this.accessToken_ = tokenResponse.access_token;
      this.storedToken_ = {
        ...this.storedToken_,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        expiresAt: Date.now() + (tokenResponse.expires_in * 1000),
      };
      // Only persist to disk for real accounts (not env pseudo-tokens with empty accountId)
      if (this.storedToken_.accountId) {
        writeAccessToken(
          kProviderName,
          this.storedToken_,
          (a, b) =>
            a.accountId === b.accountId && a.environment === b.environment,
        );
        publishDebug("Token refreshed and persisted");
      } else {
        publishDebug("Token refreshed (in-memory only, env token)");
      }
      return true;
    } catch (err) {
      publishDebug(
        `Token refresh failed: ${err}`,
      );
      return false;
    }
  }

  // --- HTTP primitives with token refresh ---

  private async apiGet<T>(path: string): Promise<T> {
    return await this.apiFetch<T>("GET", path);
  }

  private async apiPost<T>(
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    return await this.apiFetch<T>("POST", path, body);
  }

  private async apiFetch<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const url = this.buildUrl_(path);
    const headers: Record<string, string> = {
      "Accept": "application/json",
    };
    if (body) {
      headers["Content-Type"] = "application/json";
    }
    const response = await this.fetchWithRetry_(
      method,
      url,
      headers,
      body ? JSON.stringify(body) : undefined,
    );
    return await response.json() as T;
  }

  private async fetchWithRetry_(
    method: string,
    url: string,
    headers: Record<string, string>,
    body?: string | Uint8Array,
  ): Promise<Response> {
    await this.ensureValidToken_();
    const authHeaders = {
      ...headers,
      "Authorization": `Bearer ${this.accessToken_}`,
      "User-Agent": `quarto-cli/${quartoConfig.version()}`,
    };

    const response = await fetch(url, {
      method,
      headers: authHeaders,
      body,
    });

    if (response.ok) {
      return response;
    }

    // On 401, try refresh + retry once
    if (response.status === 401 && await this.tryRefreshToken_()) {
      await response.arrayBuffer();
      publishDebug("Retrying after token refresh");
      const retryResponse = await fetch(url, {
        method,
        headers: {
          ...headers,
          "Authorization": `Bearer ${this.accessToken_}`,
          "User-Agent": `quarto-cli/${quartoConfig.version()}`,
        },
        body,
      });
      if (retryResponse.ok) {
        return retryResponse;
      }
      const text = await retryResponse.text().catch(() => "");
      throw new ApiError(
        retryResponse.status,
        retryResponse.statusText,
        text || undefined,
      );
    }

    const description = await response.text().catch(() => undefined);
    throw new ApiError(response.status, response.statusText, description);
  }
}

// --- OAuth Device Code Flow (standalone functions, used by authorizeToken) ---

export async function initiateDeviceAuth(
  env: EnvironmentConfig,
): Promise<DeviceAuthResponse> {
  const params = new URLSearchParams({
    scope: kOAuthScope,
    client_id: env.clientId,
  });
  publishDebug(
    `OAuth: initiating device authorization (client_id: ${env.clientId})`,
  );
  const response = await fetch(
    `https://${env.authHost}/oauth/device/authorize`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new ApiError(
      response.status,
      response.statusText,
      text || undefined,
    );
  }
  return await response.json() as DeviceAuthResponse;
}

export async function pollForToken(
  env: EnvironmentConfig,
  deviceCode: string,
  initialInterval: number,
  expiresIn: number,
): Promise<TokenResponse> {
  let interval = Math.max(initialInterval, 5);
  const params = new URLSearchParams({
    scope: kOAuthScope,
    client_id: env.clientId,
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    device_code: deviceCode,
  });
  const url = `https://${env.authHost}/oauth/token`;
  const startTime = Date.now();
  const timeoutMs = expiresIn * 1000;

  while (true) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(
        "Authorization timed out. The verification code has expired. Please try again.",
      );
    }

    publishDebug(
      `OAuth: polling for token (interval: ${interval}s)`,
    );
    await sleep(interval * 1000);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (response.ok) {
      publishDebug("OAuth: token received");
      return await response.json() as TokenResponse;
    }

    // Parse error defensively: try JSON .error field, fall back to plain string
    const body = await response.text();
    let errorCode: string;
    try {
      const parsed = JSON.parse(body);
      errorCode = parsed.error || body;
    } catch {
      errorCode = body.trim();
    }

    switch (errorCode) {
      case "authorization_pending":
        // Keep polling
        break;
      case "slow_down":
        interval += 5;
        publishDebug(
          `OAuth: slow_down, new interval: ${interval}s`,
        );
        break;
      case "expired_token":
        throw new Error(
          "Authorization timed out. The verification code has expired. Please try again.",
        );
      case "access_denied":
        throw new Error(
          "Authorization was denied. Please try again and approve the request.",
        );
      default:
        throw new ApiError(
          response.status,
          response.statusText,
          `Unexpected OAuth error: ${errorCode}`,
        );
    }
  }
}

export async function refreshAccessToken(
  env: EnvironmentConfig,
  refreshToken: string,
): Promise<TokenResponse> {
  const params = new URLSearchParams({
    scope: kOAuthScope,
    client_id: env.clientId,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  publishDebug("Refreshing access token");
  const response = await fetch(
    `https://${env.authHost}/oauth/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new ApiError(
      response.status,
      response.statusText,
      text || undefined,
    );
  }
  return await response.json() as TokenResponse;
}

// --- Token storage helpers ---

export function readStoredTokens(): PositConnectCloudToken[] {
  return readAccessTokens<PositConnectCloudToken>(kProviderName) || [];
}

export function writeStoredTokens(tokens: PositConnectCloudToken[]) {
  writeAccessTokens(kProviderName, tokens);
}

export function writeStoredToken(token: PositConnectCloudToken) {
  writeAccessToken(
    kProviderName,
    token,
    (a, b) => a.accountId === b.accountId && a.environment === b.environment,
  );
}
