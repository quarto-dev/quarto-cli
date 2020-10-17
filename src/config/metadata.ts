/*
* metadata.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
* Unless you have received this program directly from RStudio pursuant
* to the terms of a commercial license agreement with RStudio, then
* this program is licensed to you under the terms of version 3 of the
* GNU General Public License. This program is distributed WITHOUT
* ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
* MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
* GPL (http://www.gnu.org/licenses/gpl-3.0.txt) for more details.
*
*/

import { parse } from "encoding/yaml.ts";

import type { Config } from "./config.ts";

export interface TinytexConfig {
  install?: boolean; // default: true
  ["min-times"]?: number; // default: 1
  ["max-times"]?: number; // default: 10
  clean?: boolean; // default: true
}

export type Metadata = {
  quarto?: Config;
  tinytex?: TinytexConfig;
  [key: string]: unknown;
};

export function metadataFromMarkdown(
  markdown: string,
): Metadata {
  if (markdown) {
    // capture all yaml blocks as a single yaml doc
    let yaml = "";
    const kRegExYAML =
      /(^)(---[ \t]*\n(?![ \t]*\n)[\W\w]*?\n(?:---|\.\.\.))([ \t]*)$/gm;
    kRegExYAML.lastIndex = 0;
    let match = kRegExYAML.exec(markdown);
    while (match != null) {
      yaml += match[2]
        .replace(/^---/, "")
        .replace(/---\s*$/, "");
      match = kRegExYAML.exec(markdown);
    }
    kRegExYAML.lastIndex = 0;

    // parse the yaml
    const metadata = parse(yaml, { json: true });
    return (metadata || {}) as Metadata;
  } else {
    return {};
  }
}

export function metadataFromFile(file: string): Metadata {
  const markdown = Deno.readTextFileSync(file);
  return metadataFromMarkdown(markdown);
}
