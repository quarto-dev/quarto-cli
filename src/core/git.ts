/*
 * git.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { which } from "./path.ts";
import { execProcess } from "./process.ts";
import SemVer from "semver/mod.ts";

export async function gitCmds(dir: string, cmds: Array<string[]>) {
  for (const cmd of cmds) {
    if (
      !(await execProcess({
        cmd: ["git", ...cmd],
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
      cmd: ["git", "--version"],
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
      cmd: ["git", "ls-files", ...(args || [])],
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
