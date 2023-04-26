/*
* utils.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { basename, dirname, extname, join } from "path/mod.ts";
import { parseFormatString } from "../src/core/pandoc/pandoc-formats.ts";

// caller is responsible for cleanup!
export function inTempDirectory(fn: (dir: string) => unknown): unknown {
  const dir = Deno.makeTempDirSync();
  return fn(dir);
}

// Gets output that should be created for this input file and target format
export function outputForInput(
  input: string,
  to: string,
  projectOutDir?: string,
) {
  // TODO: Consider improving this (e.g. for cases like Beamer)
  const dir = dirname(input);
  let stem = basename(input, extname(input));

  const formatDesc = parseFormatString(to);
  const baseFormat = formatDesc.baseFormat;
  if (formatDesc.baseFormat === "pdf") {
    stem = `${stem}${formatDesc.variants.join("")}${
      formatDesc.modifiers.join("")
    }`;
  }

  let outputExt = baseFormat || "html";
  if (baseFormat === "latex" || baseFormat == "context") {
    outputExt = "tex";
  }
  if (baseFormat === "revealjs") {
    outputExt = "html";
  }
  if (["commonmark", "gfm", "markdown"].some((f) => f === baseFormat)) {
    outputExt = "md";
  }
  if (baseFormat === "csljson") {
    outputExt = "csl";
  }
  if (baseFormat === "bibtex" || baseFormat === "biblatex") {
    outputExt = "bib";
  }
  if (baseFormat === "jats") {
    outputExt = "xml";
  }
  if (baseFormat === "asciidoc") {
    outputExt = "adoc";
  }

  const outputPath = projectOutDir
    ? join(dir, projectOutDir, `${stem}.${outputExt}`)
    : join(dir, `${stem}.${outputExt}`);
  const supportPath = projectOutDir
    ? join(dir, projectOutDir, `${stem}_files`)
    : join(dir, `${stem}_files`);

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

// On Windows, `quarto.cmd` needs to be explicit in `execProcess()`
export function quartoDevCmd(): string {
  return Deno.build.os === "windows" ? "quarto.cmd" : "quarto";
}
