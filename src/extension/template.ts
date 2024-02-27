/*
 * template.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { join } from "../deno_ral/path.ts";
import { existsSync } from "fs/mod.ts";
import { resolvePathGlobs } from "../core/path.ts";
import { lines } from "../core/text.ts";
import { warning } from "../deno_ral/log.ts";

const kQuartoIgnore = ".quartoignore";

export function templateFiles(dir: string) {
  // Look for a quarto ignore file
  const excludes: string[] = [];
  const includes: string[] = [];
  const ignoreFile = join(dir, kQuartoIgnore);
  if (existsSync(ignoreFile)) {
    const ignoreFileContents = Deno.readTextFileSync(ignoreFile);
    const ignoreLines = lines(ignoreFileContents.trim());
    ignoreLines.forEach((line) => {
      const splitOnComment = line.split("#");
      const exclude = splitOnComment[0];
      if (exclude && exclude.startsWith("!")) {
        if (exclude.length > 1) {
          includes.push(exclude.substring(1));
        } else {
          warning(`Unknown ignore pattern '${exclude}'`);
        }
      } else if (exclude) {
        excludes.push(exclude);
      }
    });
  }
  excludes.push(...kBuiltInExcludes);

  const filtered = excludes.filter((ex) => {
    return !includes.includes(ex);
  });

  const resolved = resolvePathGlobs(
    dir,
    ["**/*"],
    filtered,
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
  "_extensions",
];
