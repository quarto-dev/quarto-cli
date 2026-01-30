/*
 * markdown.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
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

const kPandocTitleRegex = /^\#{1,}\s(?:(.*)\s)?\{(.*)\}$/;
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
  // partition out yaml
  const partitioned = partitionYamlFrontMatter(markdown);
  markdown = partitioned ? partitioned.markdown : markdown;

  // extract heading
  const { lines, headingText, headingAttr } = markdownWithExtractedHeading(
    markdown,
  );

  // does this contain refs?
  const containsRefs = lines.some((line) =>
    /^:::\s*{#refs([\s}]|.*?})\s*$/.test(line)
  );

  return {
    yaml: (partitioned ? readYamlFromMarkdown(partitioned.yaml) : undefined),
    headingText,
    headingAttr,
    containsRefs,
    markdown: lines.join("\n"),
    srcMarkdownNoYaml: partitioned?.markdown || "",
  };
}

export function markdownWithExtractedHeading(markdown: string) {
  const mdLines: string[] = [];
  let headingText: string | undefined;
  let headingAttr: PandocAttr | undefined;
  let contentBeforeHeading = false;

  for (const line of lines(markdown)) {
    if (!headingText) {
      if (line.match(/^\#{1,}\s/)) {
        const parsedHeading = parsePandocTitle(line);
        headingText = parsedHeading.heading;
        headingAttr = parsedHeading.attr;
        contentBeforeHeading = mdLines.length !== 0;
      } else if (line.match(/^=+\s*$/) || line.match(/^-+\s*$/)) {
        const prevLine = mdLines[mdLines.length - 1];
        if (prevLine) {
          headingText = prevLine;
          mdLines.splice(mdLines.length - 1);
          contentBeforeHeading = mdLines.length !== 0;
        } else {
          mdLines.push(line);
        }
      } else {
        mdLines.push(line);
      }
    } else {
      mdLines.push(line);
    }
  }

  return {
    lines: mdLines,
    headingText,
    headingAttr,
    contentBeforeHeading,
  };
}

export function languagesInMarkdownFile(file: string) {
  return languagesInMarkdown(Deno.readTextFileSync(file));
}

export function languagesWithClasses(
  markdown: string,
): Map<string, string | undefined> {
  const result = new Map<string, string | undefined>();
  // Capture language and everything after it (including dot-joined classes like {python.marimo})
  const kChunkRegex =
    /^[\t >]*```+\s*\{([a-zA-Z][a-zA-Z0-9_.]*)([^}]*)?\}\s*$/gm;
  kChunkRegex.lastIndex = 0;
  let match = kChunkRegex.exec(markdown);
  while (match) {
    const language = match[1].toLowerCase();
    if (!result.has(language)) {
      // Extract first class from attrs (group 2)
      // Handles {python.marimo}, {python .marimo}, {python #id .marimo}, etc.
      const attrs = match[2];
      const firstClass = attrs?.match(/\.([a-zA-Z][a-zA-Z0-9_-]*)/)?.[1];
      result.set(language, firstClass);
    }
    match = kChunkRegex.exec(markdown);
  }
  kChunkRegex.lastIndex = 0;
  return result;
}

export function languagesInMarkdown(markdown: string): Set<string> {
  return new Set(languagesWithClasses(markdown).keys());
}
