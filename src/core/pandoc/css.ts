/*
 * css.ts
 *
 * Copyright (C) 2020-2023 Posit Software, PBC
 */

// Generates key values for CSS text highlighing variables
export function generateCssKeyValues(textValues: Record<string, unknown>) {
  const lines: string[] = [];
  Object.keys(textValues).forEach((textAttr) => {
    switch (textAttr) {
      case "text-color":
        lines.push(
          `color: ${textValues[textAttr]};`,
        );
        break;
      case "background-color":
        lines.push(
          `background-color: ${textValues[textAttr]};`,
        );
        break;

      case "bold":
        if (textValues[textAttr]) {
          lines.push("font-weight: bold;");
        }
        break;
      case "italic":
        if (textValues[textAttr]) {
          lines.push("font-style: italic;");
        } else {
          lines.push("font-style: inherit;");
        }
        break;
      case "underline":
        if (textValues[textAttr]) {
          lines.push("text-decoration: underline;");
        }
        break;
    }
  });
  return lines;
}

export function cssHasDarkModeSentinel(css: string) {
  return !!css.match(/\/\*! dark \*\//g);
}
