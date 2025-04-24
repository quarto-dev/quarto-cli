/*
 * github.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { runningInCI } from "../core/ci-info.ts";
import { GitHubRelease } from "./types.ts";

// deno-lint-ignore-file camelcase

// A Github Release for a Github Repo

// Look up the latest release for a Github Repo
export async function getLatestRelease(repo: string): Promise<GitHubRelease> {
  const url = `https://api.github.com/repos/${repo}/releases/latest`;
  const headers = Deno.env.get("GH_TOKEN")
    ? { headers: { Authorization: "Bearer " + Deno.env.get("GH_TOKEN") } }
    : undefined;
  const response = await fetch(url, headers);
  if (response.status !== 200) {
    throw new Error(
      `Unable to determine latest release for ${repo}\n${response.status} - ${response.statusText}`,
    );
  } else {
    return response.json();
  }
}

// NB we do not escape these here - it's the caller's responsibility to do so
function githubActionsWorkflowCommand(
  command: string,
  value = "",
  params?: Record<string, string>,
) {
  let paramsStr = "";
  if (params) {
    paramsStr = " ";
    let first = false;
    for (const [key, val] of Object.entries(params)) {
      if (!first) {
        first = true;
      } else {
        paramsStr += ",";
      }
      paramsStr += `${key}=${val}`;
    }
  }
  return `::${command}${paramsStr}::${value}`;
}

export async function group<T>(title: string, fn: () => Promise<T>) {
  if (!runningInCI()) {
    return fn();
  }
  console.log(githubActionsWorkflowCommand("group", title));
  try {
    return await fn();
  } finally {
    console.log(githubActionsWorkflowCommand("endgroup"));
  }
}
