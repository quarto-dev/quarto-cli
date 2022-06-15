/*
* github.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { GitHubRelease } from "./types.ts";

// deno-lint-ignore-file camelcase

// A Github Release for a Github Repo

// Look up the latest release for a Github Repo
export async function getLatestRelease(repo: string): Promise<GitHubRelease> {
  const url = `https://api.github.com/repos/${repo}/releases/latest`;
  const response = await fetch(url);
  return response.json();
}
