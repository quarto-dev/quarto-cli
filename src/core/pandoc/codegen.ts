/*
* codegen.ts
*
* A minimal API to build pandoc markdown text.
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

/* We should really be using Pandoc's AST here
 */

import {
  asMappedString,
  EitherString,
  mappedConcat,
  MappedString,
} from "../lib/mapped-text.ts";

export interface PandocNode {
  emit: (s: EitherString[]) => void;
  mappedString: () => MappedString;
}

const basePandocNode = {
  emit: (_ls: EitherString[]) => {
    throw new Error("unimplemented");
  },
  mappedString(): MappedString {
    const ls: EitherString[] = [];
    this.emit(ls);
    return mappedConcat(ls);
  },
};

export function pandocRawStr(content: EitherString) {
  return {
    ...basePandocNode,
    emit: (ls: EitherString[]) => ls.push(content),
  };
}

export function pandocHtmlBlock(elementName: string) {
  return function (
    opts: {
      id?: string;
      classes?: string[];
      attrs?: string[];
    } | undefined,
  ) {
    let { id, classes, attrs } = opts || {};
    if (classes === undefined) {
      classes = [];
    }
    if (attrs === undefined) {
      attrs = [];
    }

    const contents: PandocNode[] = [];
    function attrString() {
      const strs = [];
      if (id) {
        strs.push(`id="${id}"`);
      }
      if (classes) {
        strs.push(`class="${classes.join(" ")}"`);
      }
      if (attrs) {
        strs.push(...attrs.map((attr) => `data-${attr}`));
      }
      return strs.join(" ");
    }

    return {
      ...basePandocNode,
      push: function (s: PandocNode) {
        contents.push(s);
      },
      emit: function (ls: EitherString[]) {
        ls.push(`\n<${elementName} ${attrString()}>`);
        if (elementName !== "pre") {
          ls.push("\n");
        }
        for (const entry of contents) {
          entry.emit(ls);
        }
        if (elementName !== "pre") {
          ls.push("\n");
        }
        ls.push(`</${elementName}>\n`);
      },
    };
  };
}

export function pandocBlock(delimiter: string) {
  return function (
    opts: {
      language?: string;
      id?: string;
      classes?: string[];
      attrs?: string[];
    } | undefined,
  ) {
    let { id, classes, attrs, language } = opts || {};
    if (classes === undefined) {
      classes = [];
    }
    if (attrs === undefined) {
      attrs = [];
    }

    const contents: PandocNode[] = [];
    function attrString() {
      const strs = [];
      if (language) {
        strs.push(language);
      }
      if (id) {
        strs.push(`#${id}`);
      }
      if (classes) {
        strs.push(...classes.map((c) => `.${c}`));
      }
      if (attrs) {
        strs.push(...attrs);
      }
      if (strs.length) {
        return `{${strs.join(" ")}}`;
      } else {
        return "{}";
      }
    }

    return {
      ...basePandocNode,
      push: function (s: PandocNode) {
        contents.push(s);
      },
      emit: function (ls: EitherString[]) {
        ls.push(`${delimiter}${attrString()}\n`);
        for (const entry of contents) {
          entry.emit(ls);
        }
        if (!asMappedString(ls[ls.length - 1] || "\n").value.endsWith("\n")) {
          ls.push(`\n`);
        }
        ls.push(`${delimiter}\n`);
      },
    };
  };
}

export const pandocDiv = pandocHtmlBlock("div");
export const pandocCode = pandocBlock("```");
