/*
* yaml.ts
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

import { existsSync } from "fs/exists.ts";

import { parse } from "encoding/yaml.ts";

const kRegExYAML =
  /(^)(---[ \t]*\n(?![ \t]*\n)[\W\w]*?\n(?:---|\.\.\.))([ \t]*)$/gm;

export function readYaml(file: string) {
  if (existsSync(file)) {
    const decoder = new TextDecoder("utf-8");
    const yml = Deno.readFileSync(file);
    return parse(decoder.decode(yml));
  } else {
    throw new Error(`YAML file ${file} not found.`);
  }
}

export function readYamlFromString(yml: string) {
  return parse(yml);
}

export function readYamlFromMarkdown(
  markdown: string,
): { [key: string]: unknown } {
  if (markdown) {
    // capture all yaml blocks as a single yaml doc
    let yaml = "";
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
    return (metadata || {}) as { [key: string]: unknown };
  } else {
    return {};
  }
}

export function readYamlFromMarkdownFile(
  file: string,
): { [key: string]: unknown } {
  const markdown = Deno.readTextFileSync(file);
  return readYamlFromMarkdown(markdown);
}

export function readYamlFrontMatterFromMarkdown(
  markdown: string,
): string | null {
  kRegExYAML.lastIndex = 0;
  const match = kRegExYAML.exec(markdown);
  kRegExYAML.lastIndex = 0;
  if (match) {
    return match[2];
  } else {
    return null;
  }
}
