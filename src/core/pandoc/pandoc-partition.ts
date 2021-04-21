/*
* markdown.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { lines } from "../text.ts";
import { partitionYamlFrontMatter } from "../yaml.ts";
import { PandocAttr, pandocAttrParseText } from "./pandoc-attr.ts";

export function firstHeadingFromMarkdownFile(file: string): string | undefined {
  return firstHeadingFromMarkdown(Deno.readTextFileSync(file));
}

export function firstHeadingFromMarkdown(markdown: string): string | undefined {
  const partitioned = partitionMarkdown(markdown);
  return partitioned.headingText;
}

// partition markdown into yaml, the first heading, and the rest of the markdown text
export function partitionMarkdown(markdown: string) {
  const markdownLines: string[] = [];
  let markdownHeading: string | undefined;
  let markdownHeadingAttr: PandocAttr | undefined;
  const partitioned = partitionYamlFrontMatter(markdown);
  markdown = partitioned ? partitioned.markdown : markdown;
  for (const line of lines(markdown)) {
    if (!markdownHeading) {
      if (line.startsWith("#")) {
        let beginAttrPos = -1;
        let escaped = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line.charAt(i);
          if (ch === "{" && !escaped) {
            beginAttrPos = i;
            break;
          } else if (ch === "\\") {
            escaped = !escaped;
          }
        }
        markdownHeading = beginAttrPos !== -1
          ? line.slice(0, beginAttrPos)
          : line;
        markdownHeading = markdownHeading.trim().replace(
          /^#{1,}\s*/,
          "",
        );
        if (beginAttrPos !== -1) {
          const endAttrPos = line.lastIndexOf("}");
          if (endAttrPos !== -1) {
            const attr = line.slice(beginAttrPos + 1, endAttrPos);
            const parsed = pandocAttrParseText(attr);
            if (parsed) {
              markdownHeadingAttr = parsed;
            }
          }
        }
      } else if (line.match(/^=+\s*$/) || line.match(/^-+\s*$/)) {
        const prevLine = markdownLines[markdownLines.length - 1];
        if (prevLine) {
          markdownHeading = prevLine;
          markdownLines.splice(markdownLines.length - 1);
        } else {
          markdownLines.push(line);
        }
      } else {
        markdownLines.push(line);
      }
    } else {
      markdownLines.push(line);
    }
  }
  return {
    yaml: (partitioned ? partitioned.yaml : undefined),
    headingText: markdownHeading,
    headingAttr: markdownHeadingAttr,
    markdown: markdownLines.join("\n"),
  };
}
