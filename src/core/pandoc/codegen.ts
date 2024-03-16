/*
 * codegen.ts
 *
 * A minimal API to build pandoc markdown text.
 *
 * Copyright (C) 2022 Posit Software, PBC
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
  push: (n: PandocNode) => void;
  unshift: (n: PandocNode) => void;
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
  push: () => {
    throw new Error("unimplemented");
  },
  unshift: () => {
    throw new Error("unimplemented");
  },
};

export function pandocRawStr(content: EitherString): PandocNode {
  return {
    ...basePandocNode,
    emit: (ls: EitherString[]) => ls.push(content),
  };
}

export function pandocHtmlBlock(elementName: string) {
  return function (
    opts?: {
      id?: string;
      classes?: string[];
      attrs?: string[];
      contents?: PandocNode[];
    },
  ): PandocNode {
    let { id, classes, attrs, contents } = opts || {};
    if (classes === undefined) {
      classes = [];
    }
    if (attrs === undefined) {
      attrs = [];
    }

    contents = contents || [];

    function attrString() {
      const strs = [];
      if (id) {
        strs.push(`id="${id}"`);
      }
      if (classes && classes.length) {
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
        if (this !== s) {
          contents!.push(s);
        }
      },
      unshift: function (s: PandocNode) {
        if (this !== s) {
          contents!.unshift(s);
        }
      },
      emit: function (ls: EitherString[]) {
        ls.push(`\n<${elementName} ${attrString()}>`);
        if (elementName !== "pre") {
          ls.push("\n");
        }
        for (const entry of contents!) {
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

export function pandocList(opts: {
  contents?: PandocNode[];
  skipFirstLineBreak?: boolean;
}): PandocNode {
  let { contents, skipFirstLineBreak } = opts || {};
  contents = contents || [];

  return {
    ...basePandocNode,
    push: function (s: PandocNode) {
      if (this !== s) {
        contents!.push(s);
      }
    },
    unshift: function (s: PandocNode) {
      if (this !== s) {
        contents!.unshift(s);
      }
    },
    emit: function (ls: EitherString[]) {
      const lb = skipFirstLineBreak ? "" : "\n";
      ls.push(`${lb}\n`);
      for (const entry of contents!) {
        entry.emit(ls);
      }
      if (!asMappedString(ls[ls.length - 1] || "\n").value.endsWith("\n")) {
        ls.push(`\n`);
      }
      ls.push(`\n`);
    },
  };
}

export function pandocBlock(delimiterCharacter: ":" | "`") {
  return function (
    opts?: {
      language?: string;
      id?: string;
      classes?: string[];
      attrs?: string[];
      skipFirstLineBreak?: boolean;
      contents?: PandocNode[];
    },
  ): PandocNode {
    let { id, classes, attrs, language, skipFirstLineBreak, contents } = opts ||
      {};
    if (classes === undefined) {
      classes = [];
    }
    if (attrs === undefined) {
      attrs = [];
    }

    contents = contents || [];
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
        if (this !== s) {
          contents!.push(s);
        }
      },
      unshift: function (s: PandocNode) {
        if (this !== s) {
          contents!.unshift(s);
        }
      },
      emit: function (ls: EitherString[]) {
        const innerLs: EitherString[] = [];
        const lb = skipFirstLineBreak ? "" : "\n";

        for (const entry of contents!) {
          entry.emit(innerLs);
        }
        if (
          !asMappedString(innerLs[innerLs.length - 1] || "\n").value.endsWith(
            "\n",
          )
        ) {
          innerLs.push(`\n`);
        }

        // now find the longest streak of delimiter characters in the innerLs
        const longestStreak = Math.max(...innerLs.map((eitherS) => {
          const s = asMappedString(eitherS).value;
          return s.match(new RegExp(`${delimiterCharacter}+`, "g"))?.[0]
            ?.length || 0;
        }));
        const delimiter = delimiterCharacter.repeat(
          Math.max(3, longestStreak + 1),
        );
        ls.push(`${lb}${delimiter}${attrString()}\n`);

        // FIXME this will incur a runtime of eventually O(n * m) where n is the number of lines and m is the depth of
        // the PandocNode tree.
        ls.push(...innerLs);

        ls.push(`${delimiter}\n`);
      },
    };
  };
}

export const pandocDiv = pandocBlock(":");
export const pandocCode = pandocBlock("`");
export const pandocFigure = pandocHtmlBlock("figure");
export const pandocFigCaption = pandocHtmlBlock("figcaption");
