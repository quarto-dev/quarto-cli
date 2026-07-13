/*
 * render.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { kOutputExt, kOutputFile, kServer } from "../config/constants.ts";
import { Format, Metadata } from "../config/types.ts";
import { kJupyterEngine, kKnitrEngine } from "../execute/types.ts";
import { dirAndStem, pathsEqual } from "./path.ts";
import { dirname, extname, join } from "../deno_ral/path.ts";

export function inputFilesDir(input: string) {
  const [_, stem] = dirAndStem(input);
  return stem + "_files";
}

// rmarkdown derived figures dir
// (https://github.com/rstudio/rmarkdown/blob/e561d8b1a2693a0975c3443f2e2d6cee475298a3/R/render.R#L633-L639)
export function figuresDir(pandocTo?: string) {
  if (pandocTo === "html4") {
    pandocTo = "html";
  }
  pandocTo = (pandocTo || "html").replace(/[\+\-].*$/, "");
  return "figure-" + pandocTo;
}

export function isServerShiny(format?: Format) {
  const server = format?.metadata[kServer] as Metadata | undefined;
  return server?.["type"] === "shiny";
}

export function isServerShinyPython(
  format: Format,
  engine: string | undefined,
) {
  return isServerShiny(format) && engine === kJupyterEngine;
}

export function isServerShinyKnitr(
  format: Format,
  engine: string | undefined,
) {
  return isServerShiny(format) && engine === kKnitrEngine;
}

// the path a format's rendered output is written to before any project
// output-dir relocation: an explicit output-file (with the format's extension
// appended by formatOutputFile when it differs), else <input-stem>.<output-ext>.
// used to detect collisions between declared outputs and the keep-md
// intermediate naming convention (#14669); doesn't cover recipe special cases
// (--output flag, md-to-md rename, stdout) which can't produce colliding names
export function projectedOutputFile(input: string, format: Format): string {
  const outputFile = formatOutputFile(format);
  if (outputFile) {
    return join(dirname(input), outputFile);
  }
  const [dir, stem] = dirAndStem(input);
  return join(dir, `${stem}.${format.render[kOutputExt] || "html"}`);
}

// true when the keep-md intermediate location is a path another declared
// format owns, so it must not be written to or cleaned up (#14669)
export function keepMdCollidesWithFormatOutput(
  keepMd: string | undefined,
  siblingFormatOutputs: string[] | undefined,
): boolean {
  return keepMd !== undefined &&
    (siblingFormatOutputs?.some((output) => pathsEqual(output, keepMd)) ??
      false);
}

export function formatOutputFile(format: Format) {
  let outputFile = format.pandoc[kOutputFile];
  if (outputFile) {
    if (format.render[kOutputExt]) {
      // Don't append the output extension if the same output
      // extension is already present. If you update this logic,
      // be sure to contemplate files with names like:
      // file.name.ipynb
      // which should result in an output file like:
      // file.name.html
      const existingExtension = extname(outputFile);

      // If there the output file has no extension, or already has this
      // extension, don't append it, otherwise add it.
      if (
        !existingExtension ||
        existingExtension.substring(1) !== format.render[kOutputExt]
      ) {
        outputFile = `${outputFile}.${format.render[kOutputExt]}`;
      }
    }
  }
  return outputFile;
}
