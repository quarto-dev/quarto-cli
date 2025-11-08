/*
 * pandoc-to-oxa.ts
 *
 * Copyright (C) 2025 Posit Software, PBC
 */

import { assert } from "testing/asserts";
import { Attr, Block, Document, Inline, Section } from "./types.ts";

const idToOxa = (id: any) => id === "" ? undefined : id;

const attrsToOxa = (attr: any): Attr => {
  return {
    id: idToOxa(attr[0]),
    classes: attr[1],
    data: Object.fromEntries(attr[2]),
  };
};

function inlineToOxa(inline: any): Inline {
  const nameMap: Record<string, string> = {
    "Emph": "Emphasis",
  };
  const empty: Attr = {
    classes: [],
    data: {},
  };
  switch (inline.t) {
    case "Str":
      return {
        type: "Text",
        value: inline.c,
        ...empty,
      };
    case "Space":
      return {
        type: "Text",
        value: " ",
        ...empty,
      };
    case "Span": {
      const attrs = attrsToOxa(inline.c[0]);
      if (
        attrs.classes.length === 0 && (
          attrs.classes[0] === "underline" || attrs.classes[0] === "ul"
        )
      ) {
        return {
          type: "Underline",
          children: inlinesToOxa(inline.c),
          ...empty,
        };
      }
      if (
        attrs.classes.length === 0 &&
        (attrs.classes[0] === "smallcaps" || attrs.classes[0] === "sc")
      ) {
        return {
          type: "SmallCaps",
          children: inlinesToOxa(inline.c),
          ...empty,
        };
      }
      return {
        type: "Span",
        ...attrs,
        children: inlinesToOxa(inline.c),
      };
    }
    case "Emph":
    case "Strikeout":
    case "Superscript":
    case "Subscript":
    case "Underline":
    case "SmallCaps":
    case "Strong":
      return {
        type: (nameMap[inline.t] ?? inline.t) as any,
        children: inlinesToOxa(inline.c),
        ...empty,
      };
    case "Cite":
      console.log("Cite");
      console.log(JSON.stringify(inline, null, 2));
      console.log(inline.c[0]);
      return {
        type: "Cite",
        citations: inline.c[0].map((citation: any) => {
          return {
            type: "Citation",
            id: citation.citationId,
            prefix: inlinesToOxa(citation.citationPrefix),
            suffix: inlinesToOxa(citation.citationSuffix),
            mode: citation.citationMode.t,
          };
        }),
        children: inlinesToOxa(inline.c[1]),
        ...empty,
      };
    case "Math": {
      const t = inline.c[0].t === "DisplayMath" ? "DisplayMath" : "InlineMath";
      return {
        type: t,
        value: inline.c[1],
        ...empty,
      };
    }
    case "Image": {
      return {
        type: "Image",
        children: inlinesToOxa(inline.c[1]),
        title: inline.c[2][1],
        uri: inline.c[2][0],
        ...attrsToOxa(inline.c[0]),
      };
    }
    default:
      console.log(JSON.stringify(inline, null, 2));
      assert(false);
  }
}

const inlinesToOxa = (inlines: any): Inline[] => {
  const result: Inline[] = [];
  let current;
  console.log({ inlines });
  for (const inline of inlines) {
    const next = inlineToOxa(inline);
    console.log({ inline, next });
    if (!current || current.type !== "Text") {
      if (current) {
        result.push(current);
      }
      current = next;
    } else {
      assert(current.type === "Text");
      if (next.type === "Text") {
        /// booooo O(n^2) no cookie
        current.value = current.value + next.value;
      } else {
        result.push(current);
        current = next;
      }
    }
  }
  if (current) {
    result.push(current);
  }
  return result;
};

const blockToOxa = (block: any): Block => {
  const empty: Attr = { classes: [], data: {} };
  switch (block.t) {
    case "Header":
      return {
        type: "Heading",
        level: block.c[0],
        children: inlinesToOxa(block.c[2]),
        ...attrsToOxa(block.c[1]),
      };
    case "Para":
      return {
        type: "Paragraph",
        children: inlinesToOxa(block.c),
        ...empty,
      };
    case "Div":
      return {
        type: "Div",
        children: blocksToOxa(block.c[1]),
        ...attrsToOxa(block.c[0]),
      };
    case "CodeBlock":
      if (block.c[0][1].find((c: any) => c.startsWith("{"))) {
        assert(false, "unimplemented executable code block");
      }
      return {
        type: "CodeBlock",
        value: block.c[1],
        ...attrsToOxa(block.c[0]),
      };
    case "Plain":
      return {
        type: "Plain",
        children: inlinesToOxa(block.c),
        ...empty,
      };
  }
  console.log(JSON.stringify(block, null, 2));
  assert(false, "unimplemented");
};

const blocksToOxa = (blocks: any): Block[] => {
  const result: Block[] = [];
  let current: Block | undefined;
  let currentSectionLevel: number = -Infinity;
  const empty: Attr = { classes: [], data: {} };
  const newSection = (block: any): Section => {
    return {
      type: "Section",
      children: [blockToOxa(block)],
      ...empty,
    };
  };
  for (const block of blocks) {
    if (block.t === "Header") {
      const blockSectionLevel = block.c[0];
      if (!current) {
        current = newSection(block);
        currentSectionLevel = blockSectionLevel;
      } else {
        if (
          current.type !== "Section" ||
          currentSectionLevel > blockSectionLevel
        ) {
          result.push(current);
          current = newSection(block);
          currentSectionLevel = blockSectionLevel;
        } else {
          current.children.push(blockToOxa(block));
        }
      }
    } else {
      const next = blockToOxa(block);
      if (current) {
        if (current.type === "Section") {
          current!.children.push(next);
        } else {
          result.push(current);
          current = next;
        }
      } else {
        current = next;
      }
    }
  }
  if (current) {
    result.push(current);
  }
  return result;
};

export const pandocToOxa = (pandocJson: any): Document => {
  return {
    metadata: {}, // FIXME
    title: inlinesToOxa((pandocJson.meta.title ?? { c: [] }).c),
    children: blocksToOxa(pandocJson.blocks),
  };
};
