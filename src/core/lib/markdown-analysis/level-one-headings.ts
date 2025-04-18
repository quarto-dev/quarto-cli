/*
 * level-one-headings.ts
 *
 * Copyright (C) 2025 Posit Software, PBC
 */

import { join } from "../../../deno_ral/path.ts";
import { execProcess } from "../../process.ts";
import { pandocBinaryPath, resourcePath } from "../../resources.ts";

export async function hasLevelOneHeadings(markdown: string): Promise<boolean> {
  // this is O(n * m) where n is the number of blocks and m is the number of matches
  // we could do better but won't until we profile and show it's a problem

  const path = pandocBinaryPath();
  const filterPath = resourcePath(
    join("filters", "quarto-internals", "leveloneanalysis.lua"),
  );
  const result = await execProcess({
    cmd: path,
    args: ["-f", "markdown", "-t", "markdown", "-L", filterPath],
    stdout: "piped",
  }, markdown);
  return result.stdout?.trim() === "true";
}
