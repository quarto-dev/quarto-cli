/*
 * execute-inline.ts
 *
 * Copyright (C) 2021-2022 Posit Software, PBC
 */

import {
  asMappedString,
  mappedConcat,
  MappedString,
  mappedSubstring,
} from "./lib/mapped-text.ts";

export function executeInlineCodeHandler(
  language: string,
  exec: (expr: string) => string | undefined,
) {
  const exprPattern = new RegExp(
    "(^|[^`])`{" + language + "}[ \t]([^`]+)`",
    "g",
  );
  return (code: string) => {
    return code.replaceAll(exprPattern, (match, prefix, expr) => {
      const result = exec(expr.trim());
      if (result) {
        return `${prefix}${result}`;
      } else {
        return match;
      }
    });
  };
}

export function executeInlineCodeHandlerMapped(
  language: string,
  exec: (expr: string) => string | undefined,
) {
  const exprPattern = new RegExp(
    "(^|[^`])`{" + language + "}[ \t]([^`]+)`",
    "g",
  );
  return (code: MappedString) => {
    let matches: RegExpExecArray | null;
    const result: MappedString[] = [];
    let prevIndex = 0;
    while ((matches = exprPattern.exec(code.value))) {
      // everything before the match
      result.push(mappedSubstring(code, prevIndex, matches.index));
      const matchMapped = mappedSubstring(
        code,
        matches.index,
        matches.index + matches[0].length,
      );
      // the first capture group is the prefix
      const prefixMapped = mappedSubstring(
        code,
        matches.index,
        matches.index + matches[1].length,
      );
      // the second capture group is the expression
      const exprStr = matches[2];

      const exprResult = exec(exprStr.trim());
      if (exprResult) {
        result.push(prefixMapped);
        result.push(asMappedString(exprResult));
      } else {
        result.push(matchMapped);
      }

      // const expr = code.slice(matches.index + matches[1].length);
      // const result = exec(expr.trim());
      // if (result) {
      //   result.push(prefix);
      //   result.push(result);
      // } else {
      //   result.push(code.slice(prevIndex, matches.index + matches[0].length));
      // }
      prevIndex = matches.index + matches[0].length;
    }
    result.push(mappedSubstring(code, prevIndex));
    return mappedConcat(result);
  };
}
