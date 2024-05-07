/*
 * github-types.ts
 *
 * Copyright (C) 2021-2023 Posit Software, PBC
 */

export type GitHubContext = {
  git: boolean;
  repo: boolean;
  originUrl?: string;
  repoUrl?: string;
  ghPages?: boolean;
  siteUrl?: string;
  browse?: boolean;
  organization?: string;
  repository?: string;
};
