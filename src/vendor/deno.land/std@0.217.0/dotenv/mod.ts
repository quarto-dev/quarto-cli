// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

/**
 * Parses and loads environment variables from a `.env` file into the current
 * process, or stringify data into a `.env` file format.
 *
 * @module
 */

import { parse } from "./parse.ts";

export * from "./stringify.ts";
export * from "./parse.ts";

/** Options for {@linkcode load} and {@linkcode loadSync}. */
export interface LoadOptions {
  /**
   * Optional path to `.env` file. To prevent the default value from being
   * used, set to `null`.
   *
   * @default {"./.env"}
   */
  envPath?: string | null;

  /**
   * Set to `true` to export all `.env` variables to the current processes
   * environment. Variables are then accessible via `Deno.env.get(<key>)`.
   *
   * @default {false}
   */
  export?: boolean;

  /**
   * Optional path to `.env.example` file which is used for validation.
   * To prevent the default value from being used, set to `null`.
   *
   * @default {"./.env.example"}
   */
  examplePath?: string | null;

  /**
   * Set to `true` to allow required env variables to be empty. Otherwise, it
   * will throw an error if any variable is empty.
   *
   * @default {false}
   */
  allowEmptyValues?: boolean;

  /**
   * Optional path to `.env.defaults` file which is used to define default
   * (fallback) values. To prevent the default value from being used,
   * set to `null`.
   *
   * ```sh
   * # .env.defaults
   * # Will not be set if GREETING is set in base .env file
   * GREETING="a secret to everybody"
   * ```
   *
   * @default {"./.env.defaults"}
   */
  defaultsPath?: string | null;
}

/** Works identically to {@linkcode load}, but synchronously. */
export function loadSync(
  {
    envPath = ".env",
    examplePath = ".env.example",
    defaultsPath = ".env.defaults",
    export: _export = false,
    allowEmptyValues = false,
  }: LoadOptions = {},
): Record<string, string> {
  const conf = envPath ? parseFileSync(envPath) : {};

  if (defaultsPath) {
    const confDefaults = parseFileSync(defaultsPath);
    for (const [key, value] of Object.entries(confDefaults)) {
      if (!(key in conf)) {
        conf[key] = value;
      }
    }
  }

  if (examplePath) {
    const confExample = parseFileSync(examplePath);
    assertSafe(conf, confExample, allowEmptyValues);
  }

  if (_export) {
    for (const [key, value] of Object.entries(conf)) {
      if (Deno.env.get(key) !== undefined) continue;
      Deno.env.set(key, value);
    }
  }

  return conf;
}

/**
 * Load environment variables from a `.env` file.  Loaded variables are accessible
 * in a configuration object returned by the `load()` function, as well as optionally
 * exporting them to the process environment using the `export` option.
 *
 * Inspired by the node modules {@linkcode https://github.com/motdotla/dotenv | dotenv}
 * and {@linkcode https://github.com/motdotla/dotenv-expand | dotenv-expand}.
 *
 * ## Basic usage
 * ```sh
 * # .env
 * GREETING=hello world
 * ```
 *
 * Then import the environment variables using the `load` function.
 *
 * ```ts
 * // app.ts
 * import { load } from "https://deno.land/std@$STD_VERSION/dotenv/mod.ts";
 *
 * console.log(await load({export: true})); // { GREETING: "hello world" }
 * console.log(Deno.env.get("GREETING")); // hello world
 * ```
 *
 * Run this with `deno run --allow-read --allow-env app.ts`.
 *
 * .env files support blank lines, comments, multi-line values and more.
 * See Parsing Rules below for more detail.
 *
 * ## Auto loading
 * Import the `load.ts` module to auto-import from the `.env` file and into
 * the process environment.
 *
 * ```ts
 * // app.ts
 * import "https://deno.land/std@$STD_VERSION/dotenv/load.ts";
 *
 * console.log(Deno.env.get("GREETING")); // hello world
 * ```
 *
 * Run this with `deno run --allow-read --allow-env app.ts`.
 *
 * ## Files
 * Dotenv supports a number of different files, all of which are optional.
 * File names and paths are configurable.
 *
 * |File|Purpose|
 * |----|-------|
 * |.env|primary file for storing key-value environment entries
 * |.env.example|this file does not set any values, but specifies env variables which must be present in the configuration object or process environment after loading dotenv
 * |.env.defaults|specify default values for env variables to be used when there is no entry in the `.env` file
 *
 * ### Example file
 *
 * The purpose of the example file is to provide a list of environment
 * variables which must be set or already present in the process environment
 * or an exception will be thrown.  These
 * variables may be set externally or loaded via the `.env` or
 * `.env.defaults` files.  A description may also be provided to help
 * understand the purpose of the env variable. The values in this file
 * are for documentation only and are not set in the environment. Example:
 *
 * ```sh
 * # .env.example
 *
 * # With optional description (this is not set in the environment)
 * DATA_KEY=API key for the api.data.com service.
 *
 * # Without description
 * DATA_URL=
 * ```
 *
 * When the above file is present, after dotenv is loaded, if either
 * DATA_KEY or DATA_URL is not present in the environment an exception
 * is thrown.
 *
 * ### Defaults
 *
 * This file is used to provide a list of default environment variables
 * which will be used if there is no overriding variable in the `.env`
 * file.
 *
 * ```sh
 * # .env.defaults
 * KEY_1=DEFAULT_VALUE
 * KEY_2=ANOTHER_DEFAULT_VALUE
 * ```
 * ```sh
 * # .env
 * KEY_1=ABCD
 * ```
 * The environment variables set after dotenv loads are:
 * ```sh
 * KEY_1=ABCD
 * KEY_2=ANOTHER_DEFAULT_VALUE
 * ```
 *
 * ## Configuration
 *
 * Loading environment files comes with a number of options passed into
 * the `load()` function, all of which are optional.
 *
 * |Option|Default|Description
 * |------|-------|-----------
 * |envPath|./.env|Path and filename of the `.env` file.  Use null to prevent the .env file from being loaded.
 * |defaultsPath|./.env.defaults|Path and filename of the `.env.defaults` file. Use null to prevent the .env.defaults file from being loaded.
 * |examplePath|./.env.example|Path and filename of the `.env.example` file. Use null to prevent the .env.example file from being loaded.
 * |export|false|When true, this will export all environment variables in the `.env` and `.env.default` files to the process environment (e.g. for use by `Deno.env.get()`) but only if they are not already set.  If a variable is already in the process, the `.env` value is ignored.
 * |allowEmptyValues|false|Allows empty values for specified env variables (throws otherwise)
 *
 * ### Example configuration
 * ```ts
 * import { load } from "https://deno.land/std@$STD_VERSION/dotenv/mod.ts";
 *
 * const conf = await load({
 *     envPath: "./.env_prod",
 *     examplePath: "./.env_required",
 *     export: true,
 *     allowEmptyValues: true,
 *   });
 * ```
 *
 * ## Permissions
 *
 * At a minimum, loading the `.env` related files requires the `--allow-read` permission.  Additionally, if
 * you access the process environment, either through exporting your configuration or expanding variables
 * in your `.env` file, you will need the `--allow-env` permission.  E.g.
 *
 * ```sh
 * deno run --allow-read=.env,.env.defaults,.env.example --allow-env=ENV1,ENV2 app.ts
 * ```
 *
 * ## Parsing Rules
 *
 * The parsing engine currently supports the following rules:
 *
 * - Variables that already exist in the environment are not overridden with
 *   `export: true`
 * - `BASIC=basic` becomes `{ BASIC: "basic" }`
 * - empty lines are skipped
 * - lines beginning with `#` are treated as comments
 * - empty values become empty strings (`EMPTY=` becomes `{ EMPTY: "" }`)
 * - single and double quoted values are escaped (`SINGLE_QUOTE='quoted'` becomes
 *   `{ SINGLE_QUOTE: "quoted" }`)
 * - new lines are expanded in double quoted values (`MULTILINE="new\nline"`
 *   becomes
 *
 * ```
 * { MULTILINE: "new\nline" }
 * ```
 *
 * - inner quotes are maintained (think JSON) (`JSON={"foo": "bar"}` becomes
 *   `{ JSON: "{\"foo\": \"bar\"}" }`)
 * - whitespace is removed from both ends of unquoted values (see more on
 *   {@linkcode https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/Trim | trim})
 *   (`FOO= some value` becomes `{ FOO: "some value" }`)
 * - whitespace is preserved on both ends of quoted values (`FOO=" some value "`
 *   becomes `{ FOO: " some value " }`)
 * - dollar sign with an environment key in or without curly braces in unquoted
 *   values will expand the environment key (`KEY=$KEY` or `KEY=${KEY}` becomes
 *   `{ KEY: "<KEY_VALUE_FROM_ENV>" }`)
 * - escaped dollar sign with an environment key in unquoted values will escape the
 *   environment key rather than expand (`KEY=\$KEY` becomes `{ KEY: "\\$KEY" }`)
 * - colon and a minus sign with a default value(which can also be another expand
 *   value) in expanding construction in unquoted values will first attempt to
 *   expand the environment key. If it’s not found, then it will return the default
 *   value (`KEY=${KEY:-default}` If KEY exists it becomes
 *   `{ KEY: "<KEY_VALUE_FROM_ENV>" }` If not, then it becomes
 *   `{ KEY: "default" }`. Also there is possible to do this case
 *   `KEY=${NO_SUCH_KEY:-${EXISTING_KEY:-default}}` which becomes
 *   `{ KEY: "<EXISTING_KEY_VALUE_FROM_ENV>" }`)
 */
export async function load(
  {
    envPath = ".env",
    examplePath = ".env.example",
    defaultsPath = ".env.defaults",
    export: _export = false,
    allowEmptyValues = false,
  }: LoadOptions = {},
): Promise<Record<string, string>> {
  const conf = envPath ? await parseFile(envPath) : {};

  if (defaultsPath) {
    const confDefaults = await parseFile(defaultsPath);
    for (const [key, value] of Object.entries(confDefaults)) {
      if (!(key in conf)) {
        conf[key] = value;
      }
    }
  }

  if (examplePath) {
    const confExample = await parseFile(examplePath);
    assertSafe(conf, confExample, allowEmptyValues);
  }

  if (_export) {
    for (const [key, value] of Object.entries(conf)) {
      if (Deno.env.get(key) !== undefined) continue;
      Deno.env.set(key, value);
    }
  }

  return conf;
}

function parseFileSync(
  filepath: string,
): Record<string, string> {
  try {
    return parse(Deno.readTextFileSync(filepath));
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return {};
    throw e;
  }
}

async function parseFile(
  filepath: string,
): Promise<Record<string, string>> {
  try {
    return parse(await Deno.readTextFile(filepath));
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return {};
    throw e;
  }
}

function assertSafe(
  conf: Record<string, string>,
  confExample: Record<string, string>,
  allowEmptyValues: boolean,
) {
  const missingEnvVars: string[] = [];

  for (const key in confExample) {
    if (key in conf) {
      if (!allowEmptyValues && conf[key] === "") {
        missingEnvVars.push(key);
      }
    } else if (Deno.env.get(key) !== undefined) {
      if (!allowEmptyValues && Deno.env.get(key) === "") {
        missingEnvVars.push(key);
      }
    } else {
      missingEnvVars.push(key);
    }
  }

  if (missingEnvVars.length > 0) {
    const errorMessages = [
      `The following variables were defined in the example file but are not present in the environment:\n  ${
        missingEnvVars.join(
          ", ",
        )
      }`,
      `Make sure to add them to your env file.`,
      !allowEmptyValues &&
      `If you expect any of these variables to be empty, you can set the allowEmptyValues option to true.`,
    ];

    throw new MissingEnvVarsError(
      errorMessages.filter(Boolean).join("\n\n"),
      missingEnvVars,
    );
  }
}

/**
 * Error thrown in {@linkcode load} and {@linkcode loadSync} when required
 * environment variables are missing.
 */
export class MissingEnvVarsError extends Error {
  /** The keys of the missing environment variables. */
  missing: string[];
  /** Constructs a new instance. */
  constructor(message: string, missing: string[]) {
    super(message);
    this.name = "MissingEnvVarsError";
    this.missing = missing;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
