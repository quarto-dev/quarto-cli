/*
* utils.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { basename, dirname, extname, join } from "path/mod.ts";
import { parseFormatString } from "../src/core/pandoc/pandoc-formats.ts";

// Gets output that should be created for this input file and target format
export function outputForInput(input: string, to: string) {
  // TODO: Consider improving this (e.g. for cases like Beamer)
  const dir = dirname(input);
  const stem = basename(input, extname(input));

  const formatDesc = parseFormatString(to);
  const baseFormat = formatDesc.baseFormat;

  let outputExt = baseFormat || "html";
  if (baseFormat === "latex" || baseFormat == "context") {
    outputExt = "tex";
  }
  if (baseFormat === "revealjs") {
    outputExt = "html";
  }
  if (baseFormat === "commonmark") {
    outputExt = "md";
  }

  const outputPath = join(dir, `${stem}.${outputExt}`);
  const supportPath = join(dir, `${stem}_files`);

  return {
    outputPath,
    supportPath,
  };
}

export function siteOutputForInput(input: string) {
  const dir = join(dirname(input), "_site");
  const stem = basename(input, extname(input));

  const outputPath = join(dir, `${stem}.html`);
  const supportPath = join(dir, `site_libs`);

  return {
    outputPath,
    supportPath,
  };
}

export function docs(path: string): string {
  return join("docs", path);
}

export function fileLoader(...path: string[]) {
  return (file: string, to: string) => {
    const input = docs(join(...path, file));
    const output = outputForInput(input, to);
    return {
      input,
      output,
    };
  };
}
