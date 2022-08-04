// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
/**
 * Dotenv config
 * @module
 */

import { difference, removeEmptyValues } from "./util.ts";

export interface DotenvConfig {
  [key: string]: string;
}

export interface ConfigOptions {
  path?: string;
  export?: boolean;
  safe?: boolean;
  example?: string;
  allowEmptyValues?: boolean;
  defaults?: string;
}

export function parse(rawDotenv: string): DotenvConfig {
  const env: DotenvConfig = {};

  for (const line of rawDotenv.split("\n")) {
    if (!isVariableStart(line)) continue;
    const key = line.slice(0, line.indexOf("=")).trim();
    let value = line.slice(line.indexOf("=") + 1).trim();
    if (hasSingleQuotes(value)) {
      value = value.slice(1, -1);
    } else if (hasDoubleQuotes(value)) {
      value = value.slice(1, -1);
      value = expandNewlines(value);
    } else value = value.trim();
    env[key] = value;
  }

  return env;
}

const defaultConfigOptions = {
  path: `.env`,
  export: false,
  safe: false,
  example: `.env.example`,
  allowEmptyValues: false,
  defaults: `.env.defaults`,
};

export function configSync(options: ConfigOptions = {}): DotenvConfig {
  const o: Required<ConfigOptions> = { ...defaultConfigOptions, ...options };

  const conf = parseFile(o.path);

  if (o.defaults) {
    const confDefaults = parseFile(o.defaults);
    for (const key in confDefaults) {
      if (!(key in conf)) {
        conf[key] = confDefaults[key];
      }
    }
  }

  if (o.safe) {
    const confExample = parseFile(o.example);
    assertSafe(conf, confExample, o.allowEmptyValues);
  }

  if (o.export) {
    for (const key in conf) {
      if (Deno.env.get(key) !== undefined) continue;
      Deno.env.set(key, conf[key]);
    }
  }

  return conf;
}

export async function config(
  options: ConfigOptions = {},
): Promise<DotenvConfig> {
  const o: Required<ConfigOptions> = { ...defaultConfigOptions, ...options };

  const conf = await parseFileAsync(o.path);

  if (o.defaults) {
    const confDefaults = await parseFileAsync(o.defaults);
    for (const key in confDefaults) {
      if (!(key in conf)) {
        conf[key] = confDefaults[key];
      }
    }
  }

  if (o.safe) {
    const confExample = await parseFileAsync(o.example);
    assertSafe(conf, confExample, o.allowEmptyValues);
  }

  if (o.export) {
    for (const key in conf) {
      if (Deno.env.get(key) !== undefined) continue;
      Deno.env.set(key, conf[key]);
    }
  }

  return conf;
}

function parseFile(filepath: string) {
  try {
    // Avoid errors that occur in deno deploy
    // https://github.com/denoland/deno_std/issues/1957
    if (typeof Deno.readFileSync !== "function") {
      return {};
    }
    return parse(new TextDecoder("utf-8").decode(Deno.readFileSync(filepath)));
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return {};
    throw e;
  }
}

async function parseFileAsync(filepath: string) {
  try {
    return parse(
      new TextDecoder("utf-8").decode(await Deno.readFile(filepath)),
    );
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return {};
    throw e;
  }
}

function isVariableStart(str: string): boolean {
  return /^\s*[a-zA-Z_][a-zA-Z_0-9 ]*\s*=/.test(str);
}

function hasSingleQuotes(str: string): boolean {
  return /^'([\s\S]*)'$/.test(str);
}

function hasDoubleQuotes(str: string): boolean {
  return /^"([\s\S]*)"$/.test(str);
}

function expandNewlines(str: string): string {
  return str.replaceAll("\\n", "\n");
}

function assertSafe(
  conf: DotenvConfig,
  confExample: DotenvConfig,
  allowEmptyValues: boolean,
) {
  const currentEnv = Deno.env.toObject();

  // Not all the variables have to be defined in .env, they can be supplied externally
  const confWithEnv = Object.assign({}, currentEnv, conf);

  const missing = difference(
    Object.keys(confExample),
    // If allowEmptyValues is false, filter out empty values from configuration
    Object.keys(
      allowEmptyValues ? confWithEnv : removeEmptyValues(confWithEnv),
    ),
  );

  if (missing.length > 0) {
    const errorMessages = [
      `The following variables were defined in the example file but are not present in the environment:\n  ${
        missing.join(
          ", ",
        )
      }`,
      `Make sure to add them to your env file.`,
      !allowEmptyValues &&
      `If you expect any of these variables to be empty, you can set the allowEmptyValues option to true.`,
    ];

    throw new MissingEnvVarsError(errorMessages.filter(Boolean).join("\n\n"));
  }
}

export class MissingEnvVarsError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "MissingEnvVarsError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
