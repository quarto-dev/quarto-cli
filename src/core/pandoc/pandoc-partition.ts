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

export function parsePandocTitle(title: string) {
  // trim any whitespace
  title = title ? title.trim() : title;

  let beginAttrPos = -1;
  let previousCh = undefined;

  let state: "none" | "scanning" | "reading" = "none";

  // Find the start of the attributes section
  // walk from the back until we find the opening character
  // this doesn't do any depth matching - it simply looks
  // for the first valid unescaped '{' char once it is scanning
  // for attributes
  for (let i = title.length - 1; i > -1; i--) {
    const ch = title.charAt(i);

    if (previousCh === undefined && ch !== "}") {
      // attributes must be at the end of the title
      // If the string isn't terminated by } then there
      // are no valid attributes
      break;
    }

    // If the last character is a '}', start scaninng
    // to determine if this is an attribute
    if (previousCh === undefined && ch === "}") {
      state = "scanning";
      previousCh = ch;
      continue;
    }

    // We are scannning to determine whether this is indeed an attribute string
    if (state === "scanning") {
      // This is not a valid attribute string (e.g. }}, /}, ]})
      if (["/", "}", "]"].includes(ch)) {
        break;
      }

      // This is an attribute, change state from scanning to reading
      state = "reading";
      previousCh = ch;
      continue;
    }

    // We're reading the attribute contents to find the opening attribute brace
    if (state === "reading") {
      // Wait until we get to the previous character and then confirm that it wasn't
      // an escape character
      if (!["/"].includes(ch) && previousCh === "{") {
        beginAttrPos = i + 1;
        break;
      }
      previousCh = ch;
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
    yaml: (partitioned ? readYamlFromMarkdown(partitioned.yaml) : undefined),
    headingText: markdownHeading,
    headingAttr: markdownHeadingAttr,
    containsRefs: markdownContainsRefs,
    markdown: markdownLines.join("\n"),
  };
}
