/*
 * github.ts
 *
 * Copyright (C) 2021-2023 Posit Software, PBC
 */

import { which } from "./path.ts";
import { execProcess } from "./process.ts";

import { join } from "../deno_ral/path.ts";
import { existsSync } from "../deno_ral/fs.ts";
import { isHttpUrl } from "./url.ts";
import { GitHubContext } from "./github-types.ts";
import { gitBranchExists } from "./git.ts";

export async function gitHubContext(dir: string) {
  // establish dir
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
        const ghPagesRemote = await execProcess({
          cmd: [
            "git",
            "ls-remote",
            "--quiet",
            "--exit-code",
            "origin",
            "gh-pages",
          ],
          stdout: "piped",
          stderr: "piped",
        });

        context.ghPagesRemote = ghPagesRemote.success;
        if (!ghPagesRemote.success) {
          // when no gh-pages branch on remote, check local to avoid creation error
          // as if local branch exists, we don't want to create a new one
          // https://git-scm.com/docs/git-ls-remote#Documentation/git-ls-remote.txt---exit-code
          if (ghPagesRemote.code === 2) {
            context.ghPagesLocal = await gitBranchExists("gh-pages");
          } else {
            // if we go there, this means something is not right with the remote origin
            throw new Error(
              `There is an error while retrieving information from remote 'origin'.\n Git error: ${ghPagesRemote.stderr}. \n Git status code: ${ghPagesRemote.code}.`,
            );
          }
        }

        // determine siteUrl
        context.siteUrl = siteUrl(
          dir,
          context.originUrl!,
        );

        const repo = repoInfo(context.originUrl!);
        if (repo) {
          context.repoUrl = repo.repoUrl;
          context.organization = repo.organization;
          context.repository = repo.repository;
        }
      }
    }
  }

  return context;
}

const kGithubCom = "github.com";
const kGithubIo = "github.io";

const kGithubGitPattern = /^git@([^:]+):([^\/]+)\/(.+?)(?:\.git)?$/;
const kGithubHttpsPattern = /^https:\/\/([^\/]+)\/([^\/]+)\/(.+?)(?:\.git)?$/;

function repoInfo(originUrl: string) {
  // pick apart origin url for github.com
  const match = originUrl?.match(kGithubGitPattern) ||
    originUrl?.match(kGithubHttpsPattern);
  if (match && match.includes(kGithubCom)) {
    return {
      repoUrl: `https://${match[1]}/${match[2]}/${match[3]}/`,
      organization: match[2],
      repository: match[3],
    };
  }
}

function siteUrl(
  dir: string,
  originUrl: string,
) {
  // check for CNAME file
  const cname = join(dir, "CNAME");
  if (existsSync(cname)) {
    const url = Deno.readTextFileSync(cname).trim();
    if (isHttpUrl(url)) {
      return url;
    } else {
      return `https://${url}`;
    }
  } else {
    // pick apart origin url for github.com
    const match = originUrl?.match(kGithubGitPattern) ||
      originUrl?.match(kGithubHttpsPattern);

    if (match && match.includes(kGithubCom)) {
      const server = match[1].replace(kGithubCom, kGithubIo);
      const domain = `${match[2]}.${server}`;
      // user's root site uses just the domain
      if (domain === match[3]) {
        return `https://${domain}/`;
      } else {
        return `https://${domain}/${match[3]}/`;
      }
    }
  }
}
