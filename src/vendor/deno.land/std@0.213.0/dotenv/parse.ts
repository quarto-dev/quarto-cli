// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

type LineParseResult = {
  key: string;
  unquoted: string;
  interpolated: string;
  notInterpolated: string;
};

type CharactersMap = { [key: string]: string };

const RE_KeyValue =
  /^\s*(?:export\s+)?(?<key>[a-zA-Z_]+[a-zA-Z0-9_]*?)\s*=[\ \t]*('\n?(?<notInterpolated>(.|\n)*?)\n?'|"\n?(?<interpolated>(.|\n)*?)\n?"|(?<unquoted>[^\n#]*)) *#*.*$/gm;

const RE_ExpandValue =
  /(\${(?<inBrackets>.+?)(\:-(?<inBracketsDefault>.+))?}|(?<!\\)\$(?<notInBrackets>\w+)(\:-(?<notInBracketsDefault>.+))?)/g;

function expandCharacters(str: string): string {
  const charactersMap: CharactersMap = {
    "\\n": "\n",
    "\\r": "\r",
    "\\t": "\t",
  };

  return str.replace(
    /\\([nrt])/g,
    ($1: keyof CharactersMap): string => charactersMap[$1],
  );
}

function expand(str: string, variablesMap: { [key: string]: string }): string {
  if (RE_ExpandValue.test(str)) {
    return expand(
      str.replace(RE_ExpandValue, function (...params) {
        const {
          inBrackets,
          inBracketsDefault,
          notInBrackets,
          notInBracketsDefault,
        } = params[params.length - 1];
        const expandValue = inBrackets || notInBrackets;
        const defaultValue = inBracketsDefault || notInBracketsDefault;

        let value: string | undefined = variablesMap[expandValue];
        if (value === undefined) {
          value = Deno.env.get(expandValue);
        }
        return value === undefined ? expand(defaultValue, variablesMap) : value;
      }),
      variablesMap,
    );
  } else {
    return str;
  }
}

/**
 * Parse `.env` file output in an object.
 *
 * @example
 * ```ts
 * import { parse } from "https://deno.land/std@$STD_VERSION/dotenv/parse.ts";
 *
 * const env = parse("GREETING=hello world");
 * env.GREETING; // "hello world"
 * ```
 */
export function parse(rawDotenv: string): Record<string, string> {
  const env: Record<string, string> = {};

  let match;
  const keysForExpandCheck = [];

  while ((match = RE_KeyValue.exec(rawDotenv)) !== null) {
    const { key, interpolated, notInterpolated, unquoted } = match
      ?.groups as LineParseResult;

    if (unquoted) {
      keysForExpandCheck.push(key);
    }

    env[key] = typeof notInterpolated === "string"
      ? notInterpolated
      : typeof interpolated === "string"
      ? expandCharacters(interpolated)
      : unquoted.trim();
  }

  //https://github.com/motdotla/dotenv-expand/blob/ed5fea5bf517a09fd743ce2c63150e88c8a5f6d1/lib/main.js#L23
  const variablesMap = { ...env };
  keysForExpandCheck.forEach((key) => {
    env[key] = expand(env[key], variablesMap);
  });

  return env;
}
