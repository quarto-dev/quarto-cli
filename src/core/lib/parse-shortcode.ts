/*
 * parse-shortcodes.ts
 *
 * Recognizes and parses shortcodes.
 *
 * Copyright (C) 2022 Posit Software, PBC
 */

import { matchAll } from "./text.ts";
import { Shortcode } from "./parse-shortcode-types.ts";

export class InvalidShortcodeError extends Error {
  constructor(msg: string) {
    super(msg);
  }
}

export function findInlineShortcodes(content: string) {
  return Array.from(matchAll(content, /{{< (?!\/\*)(.+?)(?<!\*\/) >}}/));
}

export function isBlockShortcode(content: string, lenient?: boolean) {
  const m = content.match(/^\s*{{< (?!\/\*)(.+?)(?<!\*\/) >}}\s*$/);
  if (m) {
    try {
      return parseShortcode(m[1]);
    } catch (_e) {
      if (lenient) {
        return false;
      }
      throw _e;
    }
  }
}

function parseShortcodeCapture(capture: string): Shortcode | undefined {
  // match shortcode name
  const nameMatch = capture.match(/^\/?[a-zA-Z0-9_]+/);
  if (!nameMatch) {
    return;
  }
  const params: Shortcode["params"] = [];
  const namedParams: Shortcode["namedParams"] = {};
  const rawParams: Shortcode["rawParams"] = [];

  const name = nameMatch[0];
  let paramStr = capture.slice(name.length).trim();

  while (paramStr.length) {
    let paramMatch: RegExpMatchArray | null;

    // first we try to match name=value, name="value", or name='value'
    paramMatch = paramStr.match(/^[a-zA-Z0-9_-]+="[^"]*"/);
    if (!paramMatch) {
      paramMatch = paramStr.match(/^[a-zA-Z0-9_-]+='[^']*'/);
    }
    if (!paramMatch) {
      paramMatch = paramStr.match(/^[a-zA-Z0-9_-]+=[^"'\s]+/);
    }

    if (paramMatch) {
      const [name, value] = paramMatch[0].split("=");
      namedParams[name] = value;
      rawParams.push({
        name,
        value,
      });
      paramStr = paramStr.slice(paramMatch[0].length).trim();
      continue;
    }

    // then we try to match value, a string without quotes or equals
    paramMatch = paramStr.match(/^[^"'\s]+/);

    if (paramMatch) {
      params.push(paramMatch[0]);
      rawParams.push({
        value: paramMatch[0],
      });
      paramStr = paramStr.slice(paramMatch[0].length).trim();
      continue;
    }

    // finally, we try to match a string with double quotes or single quotes
    paramMatch = paramStr.match(/^"[^"]*"/) || paramStr.match(/^'[^']*'/);
    if (paramMatch) {
      params.push(paramMatch[0].slice(1, -1));
      rawParams.push({
        value: paramMatch[0].slice(1, -1),
      });
      paramStr = paramStr.slice(paramMatch[0].length).trim();
      continue;
    }

    throw new InvalidShortcodeError("invalid shortcode: " + capture);
  }
  return { name, params, namedParams, rawParams };
}

// TODO this should be handled by a pandoc parser.
export function parseShortcode(shortCodeCapture: string): Shortcode {
  const result = parseShortcodeCapture(shortCodeCapture);
  if (!result) {
    throw new InvalidShortcodeError("invalid shortcode: " + shortCodeCapture);
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
