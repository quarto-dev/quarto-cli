/*
* parse-shortcodes.ts
*
* Recognizes and parses shortcodes.
*
* Copyright (C) 2022 Posit Software, PBC
*
*/

import { matchAll } from "./text.ts";

export function findInlineShortcodes(content: string) {
  return Array.from(matchAll(content, /{{< (?!\/\*)(.+?)(?<!\*\/) >}}/));
}

export function isBlockShortcode(content: string) {
  const m = content.match(/^\s*{{< (?!\/\*)(.+?)(?<!\*\/) >}}\s*$/);
  if (m) {
    return parseShortcode(m[1]);
  }
}

export interface Shortcode {
  name: string;
  rawParams: {
    name?: string;
    value: string;
  }[];
  namedParams: Record<string, string>;
  params: string[];
}

// shortcode capture BNF:
// shortcode = shortcode-name shortcode-params?
// shortcode-name = [a-zA-Z0-9_]+
// shortcode-params = shortcode-param*
// shortcode-param = shortcode-param-value | shortcode-param-name "=" shortcode-param-value
// shortcode-param-name = [a-zA-Z0-9_-]+
// shortcode-param-value = [^"'\s]+ | '"' [^"]* '"' | "'" [^']* "'"
function parseShortcodeCapture(capture: string): Shortcode | undefined {
  // match shortcode name
  const nameMatch = capture.match(/^[a-zA-Z0-9_]+/);
  if (!nameMatch) {
    return;
  }
  const params: Shortcode["params"] = [];
  const namedParams: Shortcode["namedParams"] = {};
  const rawParams: Shortcode["rawParams"] = [];

  const name = nameMatch[0];
  let paramStr = capture.slice(name.length).trim();
  // match params
  const paramName = "([a-zA-Z0-9_-]+)";
  const paramValue1 = "([^\"'\\s]+)";
  const paramValue2 = `"([^"]*)"`;
  const paramValue3 = `'([^\']*)'`;

  const paramValue = `(?:${paramValue1})|(?:${paramValue2})|(?:${paramValue3})`;
  const paramNameAndValue =
    `(?:${paramName}\\s*=\\s*${paramValue1})|(?:${paramName}\\s*=\\s*${paramValue2})|(?:${paramName}\\s*=\\s*${paramValue3})`;

  const paramRe = new RegExp(`(?:${paramValue}|${paramNameAndValue})`);

  while (paramStr.length) {
    const paramMatch = paramStr.match(paramRe);
    if (!paramMatch) {
      throw new Error("invalid shortcode: " + capture);
    }

    const captures = paramMatch.slice(1).filter((x) => x !== undefined);
    if (captures.length === 1) {
      params.push(captures[0]);
      rawParams.push({
        value: captures[0],
      });
      // value only
    } else if (captures.length === 2) {
      namedParams[captures[0]] = captures[1];
      rawParams.push({
        name: captures[0],
        value: captures[1],
      });
    } else {
      throw new Error(
        "Internal Error, could not determine correct shortcode capture for " +
          capture,
      );
    }

    paramStr = paramStr.slice(paramMatch[0].length).trim();
  }
  return { name, params, namedParams, rawParams };
}

// TODO this should be handled by a pandoc parser.
export function parseShortcode(shortCodeCapture: string): Shortcode {
  const result = parseShortcodeCapture(shortCodeCapture);
  if (!result) {
    throw new Error("invalid shortcode: " + shortCodeCapture);
  }
  return result;
}

export function getShortcodeUnnamedParams(shortcode: Shortcode): string[] {
  return shortcode.params;
}

export function getShortcodeNamedParams(
  shortcode: Shortcode,
): Record<string, string> {
  return shortcode.namedParams;
}
