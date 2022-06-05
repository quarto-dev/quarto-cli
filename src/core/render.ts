/*
* render.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { kOutputExt, kOutputFile } from "../config/constants.ts";
import { Format } from "../config/types.ts";
import { dirAndStem } from "./path.ts";

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

export function formatOutputFile(format: Format) {
  let outputFile = format.pandoc[kOutputFile];
  if (outputFile) {
    if (!outputFile.match(/\..+$/) && format.render[kOutputExt]) {
      outputFile = `${outputFile}.${format.render[kOutputExt]}`;
    }
  }
  return outputFile;
}
