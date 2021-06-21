/*
* project-gitignore.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";
import { exists } from "fs/mod.ts";

import { which } from "../core/path.ts";
import { execProcess } from "../core/process.ts";

import { kQuartoScratch } from "./project-scratch.ts";
import { lines } from "../core/text.ts";
import { isEnvDir } from "../core/jupyter/capabilities.ts";

export const kQuartoIgnore = [`/${kQuartoScratch}/`];

export async function ensureGitignore(dir: string) {
  // if .gitignore exists, then ensure it has the requisite entries
  const gitignorePath = join(dir, ".gitignore");
  if (await exists(gitignorePath)) {
    const gitignore = lines(Deno.readTextFileSync(gitignorePath))
      .map((line) => line.trim());
    const requiredEntries: string[] = [];
    for (const requiredEntry of gitignoreEntries(dir)) {
      if (!gitignore.includes(requiredEntry)) {
        requiredEntries.push(requiredEntry);
      }
    }
    if (requiredEntries.length > 0) {
      writeGitignore(dir, gitignore.concat(requiredEntries));
    }
  } else if (which("git")) {
    // if it doesn't exist then auto-create if we are in a git project
    const result = await execProcess({
      cmd: ["git", "status"],
      cwd: dir,
      stdout: "piped",
      stderr: "piped",
    });
    if (result.success) {
      await createGitignore(dir);
    }
  }
}

export function createGitignore(dir: string) {
  writeGitignore(dir, gitignoreEntries(dir));
}

export function gitignoreEntries(dir: string) {
  // detect virtual environment
  const kEnv = "env/";
  if (isEnvDir(join(dir, kEnv))) {
    return kQuartoIgnore.concat(kEnv);
  } else {
    return kQuartoIgnore;
  }
}

function writeGitignore(dir: string, lines: string[]) {
  const lineEnding = Deno.build.os === "windows" ? "\r\n" : "\n";
  Deno.writeTextFileSync(
    join(dir, ".gitignore"),
    lines.join(lineEnding) + lineEnding,
  );
}
