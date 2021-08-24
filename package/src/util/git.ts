import { join } from "path/mod.ts";
import { info } from "log/mod.ts";

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
  Deno.removeSync(repoPath, { recursive: true });
}

async function checkout(dir: string, commit: string) {
  info(`Checking out ${commit}`);
  const gitCmd: string[] = [];
  gitCmd.push("git");
  gitCmd.push("checkout");
  gitCmd.push(commit);

  const p = Deno.run({
    cmd: gitCmd,
    cwd: dir,
  });

  const status = await p.status();
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

  const p = Deno.run({
    cmd: gitCmd,
    cwd: workingDir,
    stderr: "piped",
  });

  const status = await p.status();
  if (status.code !== 0) {
    throw Error("Failed to clone repo");
  }

  const output = await p.stderrOutput();
  if (output) {
    // Try to read the git clone output
    const outputTxt = new TextDecoder().decode(output);

    // Forward the output
    info(outputTxt);
    console.log("Matching", outputTxt);

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
