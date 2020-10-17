import { parse } from "encoding/yaml.ts";

import type { Config } from "./config.ts";

export type Metadata = {
  quarto?: Config;
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
