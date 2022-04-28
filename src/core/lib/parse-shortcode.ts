/*
* parse-shortcodes.ts
*
* Recognizes and parses shortcodes.
*
* Copyright (C) 2022 by RStudio, PBC
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
  params: {
    name?: string;
    value: string;
  }[];
}

export function parseShortcode(shortCodeCapture: string): Shortcode {
  const [name, ...args] = shortCodeCapture.trim().split(" ");

  return {
    name,
    params: args.map((v) => {
      const p = v.indexOf("=");
      if (p === -1) {
        return { value: v };
      } else {
        return { name: v.slice(0, p), value: v.slice(p + 1) };
      }
    }),
  };
}

export function getShortcodeUnnamedParams(shortcode: Shortcode): string[] {
  return shortcode.params.filter((p) => p.name === undefined).map((p) =>
    p.value
  );
}

export function getShortcodeNamedParams(
  shortcode: Shortcode,
): Record<string, string> {
  return Object.fromEntries(
    shortcode.params.filter((p) => p.name !== undefined).map(
      (p) => [p.name, p.value],
    ),
  );
}
