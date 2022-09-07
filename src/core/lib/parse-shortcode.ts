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
  rawParams: {
    name?: string;
    value: string;
  }[];
  namedParams: Record<string, string>;
  params: string[];
}

export function parseShortcode(shortCodeCapture: string): Shortcode {
  const [name, ...args] = shortCodeCapture.trim().split(" ");
  const namedParams: Record<string, string> = {};
  const params: string[] = [];
  const rawParams = args.map((v) => {
    const p = v.indexOf("=");
    let name: string | undefined = undefined;
    let value: string;
    if (p === -1) {
      value = v;
      params.push(value);
    } else {
      name = v.slice(0, p);
      value = v.slice(p + 1);
      namedParams[name] = value;
    }
    return { name, value };
  });

  return {
    name,
    rawParams,
    namedParams,
    params,
  };
}

export function getShortcodeUnnamedParams(shortcode: Shortcode): string[] {
  return shortcode.params;
}

export function getShortcodeNamedParams(
  shortcode: Shortcode,
): Record<string, string> {
  return shortcode.namedParams;
}
