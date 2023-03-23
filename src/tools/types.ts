/*
 * types.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { SpinnerOptions } from "../core/console-types.ts";

export const kUpdatePath = "update-path";

// Installable Tool interface
export interface InstallableTool {
  name: string;
  prereqs: InstallPreReq[];
  installed: () => Promise<boolean>;
  installDir: () => Promise<string | undefined>;
  binDir?: () => Promise<string | undefined>;
  installedVersion: () => Promise<string | undefined>;
  latestRelease: () => Promise<RemotePackageInfo>;
  preparePackage: (ctx: InstallContext) => Promise<PackageInfo>;
  verifyConfiguration?: () => Promise<ToolConfigurationState>;
  install: (pkgInfo: PackageInfo, ctx: InstallContext) => Promise<void>;
  afterInstall: (ctx: InstallContext) => Promise<boolean>; // return true if restart is required, false if not
  uninstall: (ctx: InstallContext) => Promise<void>;
}

// Prerequisites to installation. These will be checked before installation
// and if any return false, the message will be displaed and installation will be
// halted
export interface InstallPreReq {
  check: (context: InstallContext) => Promise<boolean>;
  os: string[];
  message: string;
}

// Locally accessible Package information
export interface PackageInfo {
  filePath: string;
  version: string;
}

// Remove package information
export interface RemotePackageInfo {
  url: string;
  version: string;
  assets: Array<{ name: string; url: string }>;
}

// Tool Remote information
export interface ToolInfo {
  version?: string;
  latest: GitHubRelease;
}

export interface ToolConfigurationState {
  status: "ok" | "warning" | "error";
  message?: string;
}

// InstallContext provides the API for installable tools
// InstallableTools can use the context to show progress, show info, etc...
export interface InstallContext {
  workingDir: string;
  info: (msg: string) => void;
  withSpinner: (
    options: SpinnerOptions,
    op: () => Promise<void>,
  ) => Promise<void>;
  error: (msg: string) => void;
  confirm: (msg: string, def?: boolean) => Promise<boolean>;
  download: (name: string, url: string, target: string) => Promise<void>;
  props: { [key: string]: unknown };
  flags: {
    [kUpdatePath]?: boolean;
  };
}

export interface ToolSummaryData {
  installed: boolean;
  installedVersion?: string;
  latestRelease: RemotePackageInfo;
  configuration: ToolConfigurationState;
}

export interface GitHubRelease {
  html_url: string;
  tag_name: string;
  assets: GitHubAsset[];
}

// A Downloadable Github Asset
export interface GitHubAsset {
  name: string;
  browser_download_url: string;
}
