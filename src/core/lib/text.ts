/*
 * text.ts
 *
 * Copyright (C) 2021-2022 Posit Software, PBC
 */

import { glb } from "./binary-search.ts";
import { InternalError } from "./error.ts";
import { quotedStringColor } from "./errors.ts";

export function lines(text: string): string[] {
  return text.split(/\r?\n/);
}

export function normalizeNewlines(text: string) {
  return lines(text).join("\n");
}

export function trimEmptyLines(
  lines: string[],
  trim: "leading" | "trailing" | "all" = "all",
) {
  // trim leading lines
  if (trim === "all" || trim === "leading") {
    const firstNonEmpty = lines.findIndex((line) => line.trim().length > 0);
    if (firstNonEmpty === -1) {
      return [];
    }
    lines = lines.slice(firstNonEmpty);
  }

  // trim trailing lines
  if (trim === "all" || trim === "trailing") {
    let lastNonEmpty = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim().length > 0) {
        lastNonEmpty = i;
        break;
      }
    }
    if (lastNonEmpty > -1) {
      lines = lines.slice(0, lastNonEmpty + 1);
    }
  }

  return lines;
}

// NB we can't use JS matchAll or replaceAll here because we need to support old
// Chromium in the IDE
//
// NB this mutates the regexp.
export function* matchAll(text: string, regexp: RegExp) {
  if (!regexp.global) {
    throw new Error("matchAll requires global regexps");
  }
  let match;
  while ((match = regexp.exec(text)) !== null) {
    yield match;
  }
}

export function* lineOffsets(text: string) {
  yield 0;
  for (const match of matchAll(text, /\r?\n/g)) {
    yield match.index + match[0].length;
  }
}

export function* lineBreakPositions(text: string) {
  for (const match of matchAll(text, /\r?\n/g)) {
    yield match.index;
  }
}

export function indexToLineCol(text: string) {
  const offsets = Array.from(lineOffsets(text));
  return function (offset: number) {
    if (offset === 0) {
      return {
        line: 0,
        column: 0,
      };
    }

    const startIndex = glb(offsets, offset);
    return {
      line: startIndex,
      column: offset - offsets[startIndex],
    };
  };
}

export function lineColToIndex(text: string) {
  const offsets = Array.from(lineOffsets(text));
  return function (position: { line: number; column: number }) {
    return offsets[position.line] + position.column;
  };
}

// just like the version on core/text.ts, but without the
// sprintf dependency
export function formatLineRange(
  text: string,
  firstLine: number,
  lastLine: number,
) {
  const lineWidth = Math.max(
    String(firstLine + 1).length,
    String(lastLine + 1).length,
  );
  const pad = " ".repeat(lineWidth);

  const ls = lines(text);

  const result = [];
  for (let i = firstLine; i <= lastLine; ++i) {
    const numberStr = `${pad}${i + 1}: `.slice(-(lineWidth + 2));
    const lineStr = ls[i];
    result.push({
      lineNumber: i,
      content: numberStr + quotedStringColor(lineStr),
      rawLine: ls[i],
    });
  }
  return {
    prefixWidth: lineWidth + 2,
    lines: result,
  };
}

// O(n1 * n2) naive edit string distance, don't use this on big texts!
export function editDistance(w1: string, w2: string): number {
  const cost = (c: string): number => {
    if ("_-".indexOf(c) !== -1) {
      return 1;
    }
    return 10;
  };
  const cost2 = (c1: string, c2: string): number => {
    if (c1 === c2) {
      return 0;
    }
    if ("_-".indexOf(c1) !== -1 && "_-".indexOf(c2) !== -1) {
      return 1;
    }
    if (c1.toLocaleLowerCase() === c2.toLocaleLowerCase()) {
      return 1;
    }
    const cc1 = c1.charCodeAt(0);
    const cc2 = c2.charCodeAt(0);

    if (cc1 >= 48 && cc1 <= 57 && cc2 >= 48 && cc2 <= 57) {
      return 1;
    }

    return 10;
  };

  const s1 = w1.length + 1;
  const s2 = w2.length + 1;
  const v = new Int32Array(s1 * s2);
  for (let i = 0; i < s1; ++i) {
    for (let j = 0; j < s2; ++j) {
      if (i === 0 && j === 0) {
        continue;
      } else if (i === 0) {
        v[i * s2 + j] = v[i * s2 + (j - 1)] + cost(w2[j - 1]);
      } else if (j === 0) {
        v[i * s2 + j] = v[(i - 1) * s2 + j] + cost(w1[i - 1]);
      } else {
        v[i * s2 + j] = Math.min(
          v[(i - 1) * s2 + (j - 1)] + cost2(w1[i - 1], w2[j - 1]),
          v[i * s2 + (j - 1)] + cost(w2[j - 1]),
          v[(i - 1) * s2 + j] + cost(w1[i - 1]),
        );
      }
    }
  }

  return v[(w1.length + 1) * (w2.length + 1) - 1];
}

export type CaseConvention =
  | "camelCase"
  | "capitalizationCase"
  | "underscore_case"
  | "snake_case"
  | "dash-case"
  | "kebab-case";

export function detectCaseConvention(
  key: string,
): CaseConvention | undefined {
  if (key.toLocaleLowerCase() !== key) {
    return "capitalizationCase";
  }
  const underscoreIndex = key.indexOf("_");
  if (
    underscoreIndex !== -1 &&
    underscoreIndex !== 0 &&
    underscoreIndex !== key.length - 1
  ) {
    return "underscore_case";
  }
  const dashIndex = key.indexOf("-");
  if (
    dashIndex !== -1 &&
    dashIndex !== 0 &&
    dashIndex !== key.length - 1
  ) {
    return "dash-case";
  }
  return undefined;
}

export function resolveCaseConventionRegex(
  keys: string[],
  conventions?: CaseConvention[],
): {
  pattern?: string;
  list: string[];
} {
  if (conventions !== undefined) {
    if (conventions.length === 0) {
      throw new InternalError(
        "resolveCaseConventionRegex requires nonempty `conventions`",
      );
    }
    // conventions were specified, we use them
    return {
      pattern: conventions.map((c) => `(${c})`).join("|"),
      list: conventions,
    };
  }

  // no conventions were specified, we sniff all keys to disallow near-misses
  const disallowedNearMisses: string[] = [];
  const keySet = new Set(keys);

  const addNearMiss = (value: string) => {
    if (!keySet.has(value)) {
      disallowedNearMisses.push(value);
    }
  };

  const foundConventions: Set<CaseConvention> = new Set();
  for (const key of keys) {
    const found = detectCaseConvention(key);
    if (found) {
      foundConventions.add(found);
    }
    switch (found) {
      case "capitalizationCase":
        addNearMiss(toUnderscoreCase(key));
        addNearMiss(toDashCase(key));
        break;
      case "dash-case":
        addNearMiss(toUnderscoreCase(key));
        addNearMiss(toCapitalizationCase(key));
        break;
      case "underscore_case":
        addNearMiss(toDashCase(key));
        addNearMiss(toCapitalizationCase(key));
        break;
    }
  }

  if (foundConventions.size === 0) {
    // if no evidence of any keys was found, return undefined so
    // that no required names regex is set.
    return {
      pattern: undefined,
      list: [],
    };
  }

  return {
    pattern: `(?!(${disallowedNearMisses.map((c) => `^${c}$`).join("|")}))`,
    list: Array.from(foundConventions),
  };
}

export function toDashCase(str: string): string {
  return toUnderscoreCase(str).replace(/_/g, "-");
}

export function toUnderscoreCase(str: string): string {
  return str.replace(
    /([A-Z]+)/g,
    (_match: string, p1: string) => `-${p1}`,
  ).replace(/-/g, "_").split("_").filter((x) => x.length).join("_")
    .toLocaleLowerCase();
}

export function toCapitalizationCase(str: string): string {
  return toUnderscoreCase(str).replace(
    /_(.)/g,
    (_match: string, p1: string) => p1.toLocaleUpperCase(),
  );
}

export function normalizeCaseConvention(str: string): CaseConvention {
  const map: Record<string, CaseConvention> = {
    "capitalizationCase": "capitalizationCase",
    "camelCase": "capitalizationCase",
    "underscore_case": "underscore_case",
    "snake_case": "underscore_case",
    "dash-case": "dash-case",
    "kebab-case": "dash-case",
  };
  const result = map[str];
  if (result === undefined) {
    throw new InternalError(`${str} is not a valid case convention`);
  }
  return result;
}
