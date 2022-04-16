/*
* render-info.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/
import { info } from "log/mod.ts";

import * as colors from "fmt/colors.ts";

import { kOutputExt, kSelfContained } from "../../config/constants.ts";
import { Format } from "../../config/types.ts";
import { RenderFlags } from "./types.ts";

import { extname } from "path/mod.ts";

export function isSelfContained(flags: RenderFlags, format: Format) {
  return !!(flags[kSelfContained] || format.pandoc[kSelfContained]);
}

// some extensions are 'known' to be standalone/self-contained
// see https://pandoc.org/MANUAL.html#option--standalone
const kStandaloneExtensionNames = [
  "pdf",
  "epub",
  "fb2",
  "docx",
  "rtf",
  "pptx",
  "odt",
  "ipynb",
];

const kStandaloneExtensions = kStandaloneExtensionNames.map((name) =>
  `.${name}`
);

export function isSelfContainedOutput(
  flags: RenderFlags,
  format: Format,
  finalOutput: string,
) {
  return isSelfContained(flags, format) ||
    kStandaloneExtensions.includes(extname(finalOutput));
}

export function isStandaloneFormat(format: Format) {
  return kStandaloneExtensionNames.includes(format.render[kOutputExt] || "");
}

export function renderProgress(message: string) {
  info(colors.bold(colors.blue(message)));
}
