/*
 * project-gitignore.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { join } from "path/mod.ts";
import { existsSync, walkSync } from "fs/mod.ts";

import { which } from "../core/path.ts";
import { execProcess } from "../core/process.ts";

import { kQuartoScratch } from "./project-scratch.ts";
import { lines } from "../core/text.ts";
import { isEnvDir } from "../core/jupyter/capabilities.ts";

export const kQuartoIgnore = [`/${kQuartoScratch}/`];

export async function ensureGitignore(
  dir: string,
  forceEnv = false,
): Promise<boolean> {
  // if .gitignore exists, then ensure it has the requisite entries
  const gitignorePath = join(dir, ".gitignore");
  if (existsSync(gitignorePath)) {
    const gitignore = lines(Deno.readTextFileSync(gitignorePath))
      .map((line) => line.trim());
    const requiredEntries: string[] = [];
    for (const requiredEntry of gitignoreEntries(dir, forceEnv)) {
      if (!gitignore.includes(requiredEntry)) {
        requiredEntries.push(requiredEntry);
      }
    }
    // see if we need to gitignore any .local files
    const kLocalEntry = `/_*.local`;
    if (!gitignore.includes(kLocalEntry)) {
      for (const walk of walkSync(dir, { maxDepth: 1 })) {
        if (walk.name.match(/^_.*?\.local$/)) {
          requiredEntries.push(kLocalEntry);
          break;
        }
      }
    }

    if (requiredEntries.length > 0) {
      writeGitignore(dir, gitignore.concat(requiredEntries));
      return true;
    } else {
      return false;
    }
  } else if (forceEnv) {
    await createGitignore(dir, forceEnv);
    return true;
  } else if (await which("git")) {
    // if it doesn't exist then auto-create if we are in a git project or we had the force flag
    const result = await execProcess({
      cmd: ["git", "rev-parse"],
      cwd: dir,
      stdout: "piped",
      stderr: "piped",
    });
    if (result.success) {
      await createGitignore(dir, forceEnv);
      return true;
    } else {
      return false;
    }
  } else {
    return false;
  }
}

export function createGitignore(dir: string, forceEnv = false) {
  writeGitignore(dir, gitignoreEntries(dir, forceEnv));
}

export function gitignoreEntries(dir: string, forceEnv = false) {
  // detect virtual environment
  const kEnv = "env/";
  if (forceEnv || isEnvDir(join(dir, kEnv))) {
    return ["/" + kEnv].concat(kQuartoIgnore);
  } else {
    return kQuartoIgnore;
  }
}

function writeGitignore(dir: string, lines: string[]) {
  // write gitignore
  const lineEnding = Deno.build.os === "windows" ? "\r\n" : "\n";
  Deno.writeTextFileSync(
    join(dir, ".gitignore"),
    lines.join(lineEnding) + lineEnding,
  );
}
