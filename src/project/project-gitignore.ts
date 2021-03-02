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

import { ProjectContext } from "./project-context.ts";

export const kGitignoreEntries = [
  ".quarto/",
  "*_cache/",
];

export async function ensureGitignore(project: ProjectContext) {
  // if .gitignore exists, then ensure it has the requisite entries
  const gitignorePath = join(project.dir, ".gitignore");
  if (await exists(gitignorePath)) {
    const gitignore = await Deno.readTextFileSync(gitignorePath).split(/\r?\n/)
      .map((line) => line.trim());
    const requiredEntries: string[] = [];
    for (const requiredEntry of kGitignoreEntries) {
      if (!gitignore.includes(requiredEntry)) {
        requiredEntries.push(requiredEntry);
      }
    }
    if (requiredEntries.length > 0) {
      writeGitignore(project.dir, gitignore.concat(requiredEntries));
    }
  } else if (which("git")) {
    // if it doesn't exist then auto-create if we are in a git project
    const result = await execProcess({
      cmd: ["git", "status"],
      cwd: project.dir,
      stdout: "piped",
    });
    if (result.success) {
      await createGitignore(project.dir);
    }
  }
}

export async function createGitignore(dir: string) {
  await writeGitignore(dir, kGitignoreEntries);
}

async function writeGitignore(dir: string, lines: string[]) {
  const lineEnding = Deno.build.os === "windows" ? "\r\n" : "\n";
  await Deno.writeTextFile(
    join(dir, ".gitignore"),
    lines.join(lineEnding) + lineEnding,
  );
}
