/*
* git.ts
*
* Copyright (C) 2020-2024 Posit Software, PBC
*
*/
import { join } from "../../../src/deno_ral/path.ts";
import { info } from "../../../src/deno_ral/log.ts";
import { exec } from "../../../src/deno_ral/process.ts";
import * as colors from "fmt/colors";

export interface Repo {
  dir: string;
  checkout(commit: string): Promise<void>;
}

// Provides a utility to clone a repo and call a provided function in the context of that
// repo. The function receives a repo interface which allows some basic repo operations as
// well as provides a full path to the repo.
export async function withRepo(
  workingDir: string,
  repoUrl: string,
  fn: (repo: Repo) => Promise<void>,
) {
  // clone the repo
  const repoDir = await clone(workingDir, repoUrl);
  const repoPath = join(workingDir, repoDir);

  const repo = {
    dir: repoPath,
    checkout: (commit: string) => {
      return checkout(repoPath, commit);
    },
  };
  await fn(repo);
  try {
    Deno.removeSync(repoPath, { recursive: true });
  } catch (_err) {
    info(`Folder not deleted by deno: ${repoPath}`);
  }
}

async function checkout(dir: string, commit: string) {
  info(`Checking out ${commit}`);
  const gitCmd: string[] = [];
  gitCmd.push("git");
  gitCmd.push("checkout");
  gitCmd.push(commit);

  const status = await exec(gitCmd[0], {
    args: gitCmd.slice(1),
    cwd: dir,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (status.code !== 0) {
    throw Error("Failed to checkout");
  }
}

async function clone(workingDir: string, url: string) {
  info(`Cloning ${url}`);
  const gitCmd: string[] = [];
  gitCmd.push("git");
  gitCmd.push("clone");
  gitCmd.push(url);

  const output = await exec(gitCmd[0], {
    args: gitCmd.slice(1),
    cwd: workingDir,
    stdout: "inherit",
    stderr: "piped",
  });
  if (output.code !== 0) {
    throw Error("Failed to clone repo");
  }

  const outputTxt = new TextDecoder().decode(output.stderr);
  if (outputTxt) {
    // Forward the output
    info(outputTxt);

    // Find the directory that we cloned into and return that
    const match = outputTxt.match(/^Cloning into '(.*)'\.\.\.$/m);
    if (match) {
      return match[1];
    } else {
      throw Error("Failed to determine cloned repo directory");
    }
  } else {
    throw Error("No output from git clone");
  }
}


export async function applyGitPatches(patches: string[]) {
  if (!patches) return undefined;
  info(`Applying Git patches...`);
  for (const patch of patches) {
    info(`  - patch ${colors.blue(patch)}`);
    const gitCmd: string[] = [];
    gitCmd.push("git");
    gitCmd.push("apply");
    gitCmd.push(patch);
    // this helps with newline handling in patch
    gitCmd.push("--ignore-space-change");
    // this helps debug when patch goes wrong
    // https://git-scm.com/docs/git-apply#Documentation/git-apply.txt---reject
    gitCmd.push("--reject");
    const status = await exec(gitCmd[0], {
      args: gitCmd.slice(1),
      stdout: "inherit",
      stderr: "piped",
    });
    if (status.code !== 0) {
      throw Error(`Failed to apply patch: '${patch}'`);
    }
  }
}