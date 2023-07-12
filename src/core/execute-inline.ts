/*
 * execute-inline.ts
 *
 * Copyright (C) 2021-2022 Posit Software, PBC
 */

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
