/*
* markdown.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { lines } from "./text.ts";
import { partitionYamlFrontMatter } from "./yaml.ts";

export function firstHeadingFromMarkdownFile(file: string): string | undefined {
  return firstHeadingFromMarkdown(Deno.readTextFileSync(file));
}

export function firstHeadingFromMarkdown(markdown: string): string | undefined {
  let prevLine = undefined;
  const partitioned = partitionYamlFrontMatter(markdown);
  markdown = partitioned ? partitioned.markdown : markdown;
  for (const line of lines(markdown)) {
    if (line.startsWith("#")) {
      const match = line.match(/^#{1,}\s*([^\{]+).*$/);
      if (match) {
        return match[1].trim();
      }
    } else if (line.match(/^=+\s*$/) || line.match(/^-+\s*$/)) {
      return prevLine;
    } else {
      prevLine = line;
    }
  }
  return undefined;
}
