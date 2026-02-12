/*
 * types.ts
 *
 * Copyright (C) 2020-2025 Posit Software, PBC
 *
 * Types for Posit Connect Cloud publish provider.
 */

// Environment configuration

export type PositConnectCloudEnvironment =
  | "production"
  | "staging"
  | "development";

export interface EnvironmentConfig {
  authHost: string;
  apiHost: string;
  uiHost: string;
  clientId: string;
}

// Token storage (persisted in accounts.json)

export interface PositConnectCloudToken {
  username: string;
  accountId: string;
  accountName: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  environment: string;
}

// OAuth Device Code flow responses

export interface DeviceAuthResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

// Connect Cloud API types

export interface Content {
  id: string;
  account_id: string;
  title: string;
  state: string;
  access: string;
  current_revision: Revision | null;
  next_revision: Revision | null;
  vanity_name: string | null;
  vanity_domain: string | null;
}

export interface Revision {
  id: string;
  status: string | null;
  publish_result: string | null;
  publish_error: string | null;
  publish_error_details: string | null;
  publish_log_channel: string | null;
  url: string | null;
  source_bundle_upload_url: string | null;
}

export interface Account {
  id: string;
  name: string;
  display_name: string;
  account_type: string;
  state: string;
  permissions: string[];
}

export interface User {
  id: string;
  email: string;
  display_name: string;
  completed_signup: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number | null;
  offset: number | null;
  limit: number | null;
}
