/*
 * git.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { which } from "./path.ts";
import { execProcess } from "./process.ts";
import SemVer from "semver/mod.ts";

export async function gitCmds(dir: string, argsArray: Array<string[]>) {
  for (const args of argsArray) {
    if (
      !(await execProcess({
        cmd: "git",
        args,
        cwd: dir,
      })).success
    ) {
      throw new Error();
    }
  }
}

export async function gitVersion(): Promise<SemVer> {
  const result = await execProcess(
    {
      cmd: "git",
      args: ["--version"],
      stdout: "piped",
    },
  );
  if (!result.success) {
    throw new Error(
      "Unable to determine git version. Please check that git is installed and available on your PATH.",
    );
  }
  const match = result.stdout?.match(/git version (\d+\.\d+\.\d+)/);
  if (match) {
    return new SemVer(match[1]);
  } else {
    throw new Error(
      `Unable to determine git version from string ${result.stdout}`,
    );
  }
}

export async function lsFiles(
  cwd?: string,
  args?: string[],
): Promise<string[] | undefined> {
  if (await which("git")) {
    const result = await execProcess({
      cmd: "git",
      args: ["ls-files", ...(args || [])],
      cwd,
      stdout: "piped",
      stderr: "piped",
    });

    if (result.success) {
      return result.stdout?.split("\n").filter((file) => {
        return file.length > 0;
      });
    }
  }

  return Promise.resolve(undefined);
}

export async function gitBranchExists(
  branch: string,
  cwd?: string,
): Promise<boolean | undefined> {
  if (await which("git")) {
    const result = await execProcess({
      cmd: "git",
      args: ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`],
      cwd,
      stdout: "piped",
      stderr: "piped",
    });

    return result.code === 0;
  }

  return Promise.resolve(undefined);
}

export async function gitUserIdentityConfigured(
  dir: string,
): Promise<boolean> {
  const name = await execProcess({
    cmd: "git",
    args: ["config", "user.name"],
    cwd: dir,
    stdout: "piped",
    stderr: "piped",
  });
  const email = await execProcess({
    cmd: "git",
    args: ["config", "user.email"],
    cwd: dir,
    stdout: "piped",
    stderr: "piped",
  });

  const hasName = (name.success && (name.stdout?.trim().length ?? 0) > 0) ||
    (Deno.env.get("GIT_AUTHOR_NAME")?.trim().length ?? 0) > 0 ||
    (Deno.env.get("GIT_COMMITTER_NAME")?.trim().length ?? 0) > 0;

  const hasEmail = (email.success && (email.stdout?.trim().length ?? 0) > 0) ||
    (Deno.env.get("GIT_AUTHOR_EMAIL")?.trim().length ?? 0) > 0 ||
    (Deno.env.get("GIT_COMMITTER_EMAIL")?.trim().length ?? 0) > 0;

  return hasName && hasEmail;
}

export async function gitCmdOutput(
  dir: string,
  args: string[],
): Promise<string> {
  const result = await execProcess({
    cmd: "git",
    args,
    cwd: dir,
    stdout: "piped",
    stderr: "piped",
  });

  if (!result.success) {
    throw new Error(
      `Git command failed: git ${args.join(" ")}\n${result.stderr || ""}`,
    );
  }

  return result.stdout?.trim() || "";
}
