/*
* render-info.ts
*
* Copyright (C) 2022 Posit Software, PBC
*
*/

import {
  kEmbedResources,
  kOutputExt,
  kSelfContained,
} from "../../config/constants.ts";
import { Format } from "../../config/types.ts";
import { RenderFlags } from "./types.ts";

import { extname } from "../../deno_ral/path.ts";
import { logProgress } from "../../core/log.ts";

export function isSelfContained(flags: RenderFlags, format: Format) {
  return !!(flags[kSelfContained] || format.pandoc[kSelfContained] ||
    flags[kEmbedResources] || format.pandoc[kEmbedResources]);
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
  logProgress(message);
}
