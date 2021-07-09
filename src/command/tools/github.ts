/*
* github.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

// deno-lint-ignore-file camelcase

// A Github Release for a Github Repo
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

// Look up the latest release for a Github Repo
export async function getLatestRelease(repo: string): Promise<GitHubRelease> {
  const url = `https://api.github.com/repos/${repo}/releases/latest`;
  const response = await fetch(url);
  return response.json();
}
