/*
 * text.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { sprintf } from "fmt/printf";
import { rgb24 } from "fmt/colors";

import { lines } from "./lib/text.ts";

// reexports from lib
export {
  indexToLineCol,
  lineBreakPositions,
  lineOffsets,
  lines,
  matchAll,
  normalizeNewlines,
} from "./lib/text.ts";

export function capitalizeWord(str: string) {
  return str.slice(0, 1).toUpperCase() + str.slice(1);
}

export function capitalizeTitle(str: string) {
  return str.split(/\s+/).map((str, index, arr) => {
    if (
      index === 0 || index === (arr.length - 1) || !isNotCapitalized(str)
    ) {
      return capitalizeWord(str);
    } else {
      return str;
    }
  }).join(" ");
}

function isNotCapitalized(str: string) {
  return [
    // articles
    "a",
    "an",
    "the",
    // coordinating conjunctions
    "for",
    "and",
    "nor",
    "but",
    "or",
    "yet",
    "so",
    // prepositions
    "with",
    "at",
    "by",
    "to",
    "in",
    "for",
    "from",
    "of",
    "on",
  ].includes(str);
}

export function formatLineRange(
  text: string,
  firstLine: number,
  lastLine: number,
) {
  const lineWidth = Math.max(
    String(firstLine + 1).length,
    String(lastLine + 1).length,
  );

  const ls = lines(text);

  const result = [];
  for (let i = firstLine; i <= lastLine; ++i) {
    const numberStr = rgb24(sprintf(`%${lineWidth}d: `, i + 1), 0x800000);
    const lineStr = rgb24(ls[i], 0xff0000);
    result.push({
      lineNumber: i,
      content: numberStr + lineStr,
      rawLine: ls[i],
    });
  }
  return {
    prefixWidth: lineWidth + 2,
    lines: result,
  };
}

const kLastPunctuationRegex = /([\S\s]*)[\.\?\!]/;
function trimSentence(text: string) {
  const match = text.match(kLastPunctuationRegex);
  if (match) {
    return {
      text: match[0],
      trimmed: true,
    };
  } else {
    return {
      text,
      trimmed: false,
    };
  }
}

function trimLength(text: string, length: number) {
  if (text.length < length) {
    return {
      text,
      trimmed: false,
    };
  } else {
    return {
      text: text.substring(0, length),
      trimmed: true,
    };
  }
}

function trimSpace(text: string) {
  const lastSpace = text.lastIndexOf(" ");
  if (lastSpace > 0) {
    return {
      text: text.substring(0, lastSpace),
      trimmed: true,
    };
  } else {
    return {
      text,
      trimmed: false,
    };
  }
}

export function truncateText(
  text: string,
  length: number,
  breakAt: "space" | "punctuation",
) {
  const trimEnd = (text: string) => {
    if ([",", "/", ":"].includes(text.charAt(text.length - 1))) {
      return text.substring(0, text.length - 1);
    } else {
      return text;
    }
  };

  const trimAtSpace = (text: string) => {
    const spaceResult = trimSpace(
      text.substring(0, text.length - 1),
    );
    return trimEnd(spaceResult.text) + "…";
  };

  const trimPunc = (text: string) => {
    const puncResult = trimSentence(text);
    if (puncResult.trimmed) {
      return puncResult.text;
    } else {
      return trimAtSpace(puncResult.text);
    }
  };

  const lengthResult = trimLength(text, length);
  if (lengthResult.trimmed) {
    // This was shortened
    if (breakAt === "punctuation") {
      return trimPunc(lengthResult.text);
    } else {
      return trimAtSpace(lengthResult.text);
    }
  } else {
    // This wasn't shortened
    return lengthResult.text;
  }
}
