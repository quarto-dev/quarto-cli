/*
 * render.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { kOutputExt, kOutputFile, kServer } from "../config/constants.ts";
import { Format, Metadata } from "../config/types.ts";
import { kJupyterEngine, kKnitrEngine } from "../execute/types.ts";
import { dirAndStem } from "./path.ts";
import { extname } from "../deno_ral/path.ts";

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
