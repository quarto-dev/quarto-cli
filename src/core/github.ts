import { which } from "./path.ts";
import { execProcess } from "./process.ts";

import { join } from "path/mod.ts";
import { existsSync } from "fs/mod.ts";
import { isHttpUrl } from "./url.ts";

export type GitHubContext = {
  git: boolean;
  repo: boolean;
  originUrl?: string;
  ghPages?: boolean;
  siteUrl?: string;
  browse?: boolean;
};

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
        context.ghPages = (await execProcess({
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
        })).success;

        // determine siteUrl
        context.siteUrl = siteUrl(
          dir,
          context.originUrl!,
        );
      }
    }
  }

  return context;
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
    const match = originUrl?.match(
      /^git@([^:]+):([^\/]+)\/(.+?)\.git$/,
    ) || originUrl?.match(
      /^https:\/\/([^\/]+)\/([^\/]+)\/(.+?)\.git$/,
    );

    const kGithubCom = "github.com";
    const kGithubIo = "github.io";
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
