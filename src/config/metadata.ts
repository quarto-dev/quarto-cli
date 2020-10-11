import { parse } from "encoding/yaml.ts";

import type { QuartoConfig } from "./config.ts";

export type Metadata = {
  quarto?: QuartoConfig;
  [key: string]: unknown;
};

export async function metadataFromMarkdown(
  markdown: string,
): Promise<Metadata> {
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
    return Promise.resolve((metadata || {}) as Metadata);
  } else {
    return {};
  }
}

export async function metadataFromFile(file: string): Promise<Metadata> {
  const markdown = await Deno.readTextFile(file);
  return metadataFromMarkdown(markdown);
}
