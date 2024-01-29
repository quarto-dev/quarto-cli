// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

// deno-lint-ignore no-explicit-any
const { Deno } = globalThis as any;

const ALREADY_WARNED_DEPRECATED = new Set<string>();
const ENV_VAR_KEY = "DENO_NO_DEPRECATION_WARNINGS";
const shouldDisableDeprecatedApiWarning =
  Deno?.permissions.querySync?.({ name: "env", variable: ENV_VAR_KEY })
      .state === "granted" && Deno?.env.has(ENV_VAR_KEY);

interface WarnDeprecatedApiConfig {
  /** The name of the deprecated API. */
  apiName: string;
  /** The stack trace of the deprecated API. */
  stack: string;
  /** The version in which the API will be removed. */
  removalVersion: string;
  /** An optional message to print. */
  suggestion?: string;
}

/**
 * Prints a warning message to the console for the given deprecated API.
 *
 * These warnings can be disabled by setting `DENO_NO_DEPRECATION_WARNINGS=1`
 * in the current process.
 *
 * Mostly copied from
 * {@link https://github.com/denoland/deno/blob/c62615bfe5a070c2517f3af3208d4308c72eb054/runtime/js/99_main.js#L101}.
 */
export function warnOnDeprecatedApi(config: WarnDeprecatedApiConfig) {
  if (shouldDisableDeprecatedApiWarning) return;

  const key = config.apiName + config.stack;
  if (ALREADY_WARNED_DEPRECATED.has(key)) return;

  // If we haven't warned yet, let's do some processing of the stack trace
  // to make it more useful.
  const stackLines = config.stack.split("\n");
  stackLines.shift();

  let isFromRemoteDependency = false;
  const firstStackLine = stackLines[0];
  if (firstStackLine && !firstStackLine.includes("file:")) {
    isFromRemoteDependency = true;
  }

  ALREADY_WARNED_DEPRECATED.add(key);
  console.log(
    "%cWarning",
    "color: yellow; font-weight: bold;",
  );
  console.log(
    `%c\u251c Use of deprecated "${config.apiName}" API.`,
    "color: yellow;",
  );
  console.log("%c\u2502", "color: yellow;");
  console.log(
    `%c\u251c This API will be removed in version ${config.removalVersion} of the Deno Standard Library.`,
    "color: yellow;",
  );
  console.log("%c\u2502", "color: yellow;");
  console.log(
    `%c\u251c Suggestion: ${config.suggestion}`,
    "color: yellow;",
  );
  if (isFromRemoteDependency) {
    console.log("%c\u2502", "color: yellow;");
    console.log(
      `%c\u251c Suggestion: It appears this API is used by a remote dependency.`,
      "color: yellow;",
    );
    console.log(
      "%c\u2502             Try upgrading to the latest version of that dependency.",
      "color: yellow;",
    );
  }

  console.log("%c\u2502", "color: yellow;");
  console.log("%c\u2514 Stack trace:", "color: yellow;");
  for (let i = 0; i < stackLines.length; i++) {
    console.log(
      `%c  ${i == stackLines.length - 1 ? "\u2514" : "\u251c"}\u2500 ${
        stackLines[i].trim()
      }`,
      "color: yellow;",
    );
  }
  console.log();
}
