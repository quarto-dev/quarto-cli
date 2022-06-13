/*
* index.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/mod.ts";
import { join } from "path/mod.ts";

import { which } from "../../../core/path.ts";
import { execProcess } from "../../../core/process.ts";

export type GitHubContext = {
  git: boolean;
  repo: boolean;
  originUrl?: string;
  ghPages?: boolean;
  siteUrl?: string;
};

export async function gitHubContext(dir: string) {
  const context: GitHubContext = {
    git: false,
    repo: false,
  };

  // check for git
  context.git = !!(await which("git"));

  // check for a repo in this directory
  if (context.git) {
    context.repo = (await execProcess({
      cmd: ["git", "rev-parse"],
      cwd: dir,
      stdout: "piped",
      stderr: "piped",
    })).success;

    // check for an origin remote
    if (context.repo) {
      const result = await execProcess({
        cmd: ["git", "config", "--get", "remote.origin.url"],
        cwd: dir,
        stdout: "piped",
        stderr: "piped",
      });
      if (result.success) {
        context.originUrl = result.stdout?.trim();

        // check for a gh-pages branch
        context.ghPages = (await execProcess({
          cmd: [
            "git",
            "ls-remote",
            "--quiet",
            "--exit-code",
            "origin",
            "gh-pages",
          ],
        })).success;

        // determine siteUrl
        context.siteUrl = siteUrl(dir, context.originUrl!);
      }
    }
  }

  return context;
}

function siteUrl(dir: string, originUrl: string) {
  const cname = join(dir, "CNAME");
  if (existsSync(cname)) {
    return Deno.readTextFileSync(cname).trim();
  } else {
    // git and ssh protccols
    const match = originUrl?.match(
      /git@([^:]+):([^\/]+)\/([^.]+)\.git/,
    ) || originUrl?.match(
      /https:\/\/([^\/]+)\/([^\/]+)\/([^.]+)\.git/,
    );

    if (match) {
      const server = match[1].replace("github.com", "github.io");
      return `https://${match[2]}.${server}/${match[3]}/`;
    }
  }
}
