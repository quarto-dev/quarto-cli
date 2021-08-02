/*
* markdown.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { PandocAttr, PartitionedMarkdown } from "./types.ts";

import { lines } from "../text.ts";
import { partitionYamlFrontMatter } from "../yaml.ts";
import { pandocAttrParseText } from "./pandoc-attr.ts";

export function firstHeadingFromMarkdownFile(file: string): string | undefined {
  return firstHeadingFromMarkdown(Deno.readTextFileSync(file));
}

export function firstHeadingFromMarkdown(markdown: string): string | undefined {
  const partitioned = partitionMarkdown(markdown);
  return partitioned.headingText;
}

export function parsePandocTitle(title: string) {
  let beginAttrPos = -1;
  let escaped = false;
  for (let i = 0; i < title.length; i++) {
    const ch = title.charAt(i);
    if (ch === "{" && !escaped) {
      beginAttrPos = i;
      break;
    } else if (ch === "\\") {
      escaped = !escaped;
    }
  }

  let markdownHeading = beginAttrPos !== -1
    ? title.slice(0, beginAttrPos)
    : title;
  markdownHeading = markdownHeading.trim().replace(
    /^#{1,}\s*/,
    "",
  );

  let markdownHeadingAttr;
  if (beginAttrPos !== -1) {
    const endAttrPos = title.lastIndexOf("}");
    if (endAttrPos !== -1) {
      const attr = title.slice(beginAttrPos + 1, endAttrPos);
      const parsed = pandocAttrParseText(attr);
      if (parsed) {
        markdownHeadingAttr = parsed;
      }
    }
  }

  return {
    heading: markdownHeading,
    attr: markdownHeadingAttr,
  };
}

// partition markdown into yaml, the first heading, and the rest of the markdown text
export function partitionMarkdown(markdown: string): PartitionedMarkdown {
  const markdownLines: string[] = [];
  let markdownHeading: string | undefined;
  let markdownHeadingAttr: PandocAttr | undefined;
  let markdownContainsRefs = false;
  const partitioned = partitionYamlFrontMatter(markdown);
  markdown = partitioned ? partitioned.markdown : markdown;
  for (const line of lines(markdown)) {
    // does this line contains the refs div?
    if (!markdownContainsRefs) {
      markdownContainsRefs = /^:::\s*{#refs([\s}]|.*?})\s*$/.test(line);
    }

    if (!markdownHeading) {
      if (line.startsWith("#")) {
        const parsedHeading = parsePandocTitle(line);
        markdownHeading = parsedHeading.heading;
        markdownHeadingAttr = parsedHeading.attr;
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
    containsRefs: markdownContainsRefs,
    markdown: markdownLines.join("\n"),
  };
}
