/*
 * git.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { which } from "./path.ts";
import { execProcess } from "./process.ts";

export async function lsFiles(
  cwd?: string,
  args?: string[],
): Promise<string[] | undefined> {
  if (await which("git")) {
    const result = await execProcess("git", {
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
