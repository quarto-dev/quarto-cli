/*
* template.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";
import { existsSync } from "fs/mod.ts";
import { resolvePathGlobs } from "../core/path.ts";
import { lines } from "../core/text.ts";

const kQuartoIgnore = ".quartoignore";

export function templateFiles(dir: string) {
  // Look for a quarto ignore file
  const excludes: string[] = [];
  const ignoreFile = join(dir, kQuartoIgnore);
  if (existsSync(ignoreFile)) {
    const ignoreFileContents = Deno.readTextFileSync(ignoreFile);
    const ignoreLines = lines(ignoreFileContents.trim());
    ignoreLines.forEach((line) => {
      excludes.push(line);
    });
  }
  excludes.push(...kBuiltInExcludes);

  const resolved = resolvePathGlobs(
    dir,
    ["**/*"],
    excludes,
  );
  return resolved.include;
}

const kBuiltInExcludes = [
  ".*",
  "COPYING.md",
  "COPYRIGHT",
  "README.md",
  "CHANGELOG.md",
  "COPYRIGHT",
  "LICENSE",
];
