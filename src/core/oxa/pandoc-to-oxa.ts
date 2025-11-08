/*
 * pandoc-to-oxa.ts
 *
 * Copyright (C) 2025 Posit Software, PBC
 */

import { assert } from "testing/asserts";

function inlineToOxa(inline: any): any {
  switch (inline.t) {
    case "Str":
      return {
        type: "Text",
        value: inline.c,
      };
    case "Space":
      return {
        type: "Text",
        value: " ",
      };
    case "Strong":
      return {
        type: "Strong",
        children: inlinesToOxa(inline.c),
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
      };
    case "Math": {
      const t = inline.c[0].t === "DisplayMath" ? "DisplayMath" : "InlineMath";
      return {
        type: t,
        value: inline.c[1],
      };
    }
    case "Image": {
      return {
        type: "Image",
        children: inlinesToOxa(inline.c[1]),
        title: inline.c[2][1],
        url: inline.c[2][0],
        ...attrsToOxa(inline.c[0]),
      };
    }
    default:
      console.log(JSON.stringify(inline, null, 2));
      assert(false);
  }
}

const inlinesToOxa = (inlines: any): any => {
  const result: any = [];
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

const idToOxa = (id: any) => id === "" ? undefined : id;

const attrsToOxa = (attr: any): any => {
  return {
    id: idToOxa(attr[0]),
    classes: attr[1],
    data: Object.fromEntries(attr[2]),
  };
};

const blockToOxa = (block: any): any => {
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
      };
  }
  console.log(JSON.stringify(block, null, 2));
  assert(false, "unimplemented");
};

const blocksToOxa = (blocks: any): any => {
  const result: any = [];
  let current: any;
  let currentSectionLevel: any;
  const newSection = (block: any) => {
    return {
      type: "Section",
      children: [blockToOxa(block)],
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

export const pandocToOxa = (pandocJson: any): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  result.title = inlinesToOxa(pandocJson.meta.title.c);
  result.children = blocksToOxa(pandocJson.blocks);
  return result;
};
