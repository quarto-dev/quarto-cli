/*
* markdown.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { PandocAttr, PartitionedMarkdown } from "./types.ts";

import { lines } from "../text.ts";
import { partitionYamlFrontMatter, readYamlFromMarkdown } from "../yaml.ts";
import { pandocAttrParseText } from "./pandoc-attr.ts";

export function firstHeadingFromMarkdownFile(file: string): string | undefined {
  return firstHeadingFromMarkdown(Deno.readTextFileSync(file));
}

export function firstHeadingFromMarkdown(markdown: string): string | undefined {
  const partitioned = partitionMarkdown(markdown);
  return partitioned.headingText;
}

const kPandocTitleRegex = /^\#{1,}\s(.*)\s\{(.*)\}$/;
const kRemoveHeadingRegex = /^#{1,}\s*/;

export function parsePandocTitle(title: string) {
  // trim any whitespace
  title = title ? title.trim() : title;
  const match = title.match(kPandocTitleRegex);
  if (match) {
    const titleRaw = match[1];
    const attrRaw = match[2];
    const parsed = pandocAttrParseText(attrRaw);
    if (parsed) {
      return {
        heading: titleRaw,
        attr: parsed,
      };
    } else {
      return {
        heading: titleRaw,
      };
    }
  } else {
    return {
      heading: title.replace(kRemoveHeadingRegex, "").trim(),
    };
  }
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
    yaml: (partitioned ? readYamlFromMarkdown(partitioned.yaml) : undefined),
    headingText: markdownHeading,
    headingAttr: markdownHeadingAttr,
    containsRefs: markdownContainsRefs,
    markdown: markdownLines.join("\n"),
  };
}
