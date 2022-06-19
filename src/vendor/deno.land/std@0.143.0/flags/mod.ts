// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
/**
 * This module is browser compatible.
 *
 * @module
 */
import { assert } from "../_util/assert.ts";

/** The value returned from `parse`. */
export interface Args {
  /** Contains all the arguments that didn't have an option associated with
   * them. */
  _: Array<string | number>;
  // deno-lint-ignore no-explicit-any
  [key: string]: any;
}

/** The options for the `parse` call. */
export interface ParseOptions {
  /** When `true`, populate the result `_` with everything before the `--` and
   * the result `['--']` with everything after the `--`. Here's an example:
   *
   * ```ts
   * // $ deno run example.ts -- a arg1
   * import { parse } from "./mod.ts";
   * console.dir(parse(Deno.args, { "--": false }));
   * // output: { _: [ "a", "arg1" ] }
   * console.dir(parse(Deno.args, { "--": true }));
   * // output: { _: [], --: [ "a", "arg1" ] }
   * ```
   *
   * Defaults to `false`.
   */
  "--"?: boolean;

  /** An object mapping string names to strings or arrays of string argument
   * names to use as aliases. */
  alias?: Record<string, string | string[]>;

  /** A boolean, string or array of strings to always treat as booleans. If
   * `true` will treat all double hyphenated arguments without equal signs as
   * `boolean` (e.g. affects `--foo`, not `-f` or `--foo=bar`) */
  boolean?: boolean | string | string[];

  /** An object mapping string argument names to default values. */
  default?: Record<string, unknown>;

  /** When `true`, populate the result `_` with everything after the first
   * non-option. */
  stopEarly?: boolean;

  /** A string or array of strings argument names to always treat as strings. */
  string?: string | string[];

  /** A string or array of strings argument names to always treat as arrays.
   * Collectable options can be used multiple times. All values will be
   * colelcted into one array. If a non-collectable option is used multiple
   * times, the last value is used. */
  collect?: string | string[];

  /** A string or array of strings argument names which can be negated
   * by prefixing them with `--no-`, like `--no-config`. */
  negatable?: string | string[];

  /** A function which is invoked with a command line parameter not defined in
   * the `options` configuration object. If the function returns `false`, the
   * unknown option is not added to `parsedArgs`. */
  unknown?: (arg: string, key?: string, value?: unknown) => unknown;
}

interface Flags {
  bools: Record<string, boolean>;
  strings: Record<string, boolean>;
  collect: Record<string, boolean>;
  negatable: Record<string, boolean>;
  unknownFn: (arg: string, key?: string, value?: unknown) => unknown;
  allBools: boolean;
}

interface NestedMapping {
  [key: string]: NestedMapping | unknown;
}

const { hasOwn } = Object;

function get<T>(obj: Record<string, T>, key: string): T | undefined {
  if (hasOwn(obj, key)) {
    return obj[key];
  }
}

function getForce<T>(obj: Record<string, T>, key: string): T {
  const v = get(obj, key);
  assert(v != null);
  return v;
}

function isNumber(x: unknown): boolean {
  if (typeof x === "number") return true;
  if (/^0x[0-9a-f]+$/i.test(String(x))) return true;
  return /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(e[-+]?\d+)?$/.test(String(x));
}

function hasKey(obj: NestedMapping, keys: string[]): boolean {
  let o = obj;
  keys.slice(0, -1).forEach((key) => {
    o = (get(o, key) ?? {}) as NestedMapping;
  });

  const key = keys[keys.length - 1];
  return key in o;
}

/** Take a set of command line arguments, optionally with a set of options, and
 * return an object representing the flags found in the passed arguments.
 *
 * By default any arguments starting with `-` or `--` are considered boolean
 * flags. If the argument name is followed by an equal sign (`=`) it is
 * considered a key-value pair. Any arguments which could not be parsed are
 * available in the `_` property of the returned object.
 *
 * ```ts
 * import { parse } from "./mod.ts";
 * const parsedArgs = parse(Deno.args);
 * ```
 *
 * ```ts
 * import { parse } from "./mod.ts";
 * const parsedArgs = parse(["--foo", "--bar=baz", "--no-qux", "./quux.txt"]);
 * // parsedArgs: { foo: true, bar: "baz", qux: false, _: ["./quux.txt"] }
 * ```
 */
export function parse(
  args: string[],
  {
    "--": doubleDash = false,
    alias = {},
    boolean = false,
    default: defaults = {},
    stopEarly = false,
    string = [],
    collect = [],
    negatable = [],
    unknown = (i: string): unknown => i,
  }: ParseOptions = {},
): Args {
  const flags: Flags = {
    bools: {},
    strings: {},
    unknownFn: unknown,
    allBools: false,
    collect: {},
    negatable: {},
  };

  if (boolean !== undefined) {
    if (typeof boolean === "boolean") {
      flags.allBools = !!boolean;
    } else {
      const booleanArgs = typeof boolean === "string" ? [boolean] : boolean;

      for (const key of booleanArgs.filter(Boolean)) {
        flags.bools[key] = true;
      }
    }
  }

  const aliases: Record<string, string[]> = {};
  if (alias !== undefined) {
    for (const key in alias) {
      const val = getForce(alias, key);
      if (typeof val === "string") {
        aliases[key] = [val];
      } else {
        aliases[key] = val;
      }
      for (const alias of getForce(aliases, key)) {
        aliases[alias] = [key].concat(aliases[key].filter((y) => alias !== y));
      }
    }
  }

  if (string !== undefined) {
    const stringArgs = typeof string === "string" ? [string] : string;

    for (const key of stringArgs.filter(Boolean)) {
      flags.strings[key] = true;
      const alias = get(aliases, key);
      if (alias) {
        for (const al of alias) {
          flags.strings[al] = true;
        }
      }
    }
  }

  if (collect !== undefined) {
    const collectArgs = typeof collect === "string" ? [collect] : collect;

    for (const key of collectArgs.filter(Boolean)) {
      flags.collect[key] = true;
      const alias = get(aliases, key);
      if (alias) {
        for (const al of alias) {
          flags.collect[al] = true;
        }
      }
    }
  }

  if (negatable !== undefined) {
    const negatableArgs = typeof negatable === "string"
      ? [negatable]
      : negatable;

    for (const key of negatableArgs.filter(Boolean)) {
      flags.negatable[key] = true;
      const alias = get(aliases, key);
      if (alias) {
        for (const al of alias) {
          flags.negatable[al] = true;
        }
      }
    }
  }

  const argv: Args = { _: [] };

  function argDefined(key: string, arg: string): boolean {
    return (
      (flags.allBools && /^--[^=]+$/.test(arg)) ||
      get(flags.bools, key) ||
      !!get(flags.strings, key) ||
      !!get(aliases, key)
    );
  }

  function setKey(
    obj: NestedMapping,
    name: string,
    value: unknown,
    collect = true,
  ): void {
    let o = obj;
    const keys = name.split(".");
    keys.slice(0, -1).forEach(function (key): void {
      if (get(o, key) === undefined) {
        o[key] = {};
      }
      o = get(o, key) as NestedMapping;
    });

    const key = keys[keys.length - 1];
    const collectable = collect && !!get(flags.collect, name);

    if (!collectable) {
      o[key] = value;
    } else if (get(o, key) === undefined) {
      o[key] = [value];
    } else if (Array.isArray(get(o, key))) {
      (o[key] as unknown[]).push(value);
    } else {
      o[key] = [get(o, key), value];
    }
  }

  function setArg(
    key: string,
    val: unknown,
    arg: string | undefined = undefined,
    collect?: boolean,
  ): void {
    if (arg && flags.unknownFn && !argDefined(key, arg)) {
      if (flags.unknownFn(arg, key, val) === false) return;
    }

    const value = !get(flags.strings, key) && isNumber(val) ? Number(val) : val;
    setKey(argv, key, value, collect);

    const alias = get(aliases, key);
    if (alias) {
      for (const x of alias) {
        setKey(argv, x, value, collect);
      }
    }
  }

  function aliasIsBoolean(key: string): boolean {
    return getForce(aliases, key).some(
      (x) => typeof get(flags.bools, x) === "boolean",
    );
  }

  let notFlags: string[] = [];

  // all args after "--" are not parsed
  if (args.includes("--")) {
    notFlags = args.slice(args.indexOf("--") + 1);
    args = args.slice(0, args.indexOf("--"));
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (/^--.+=/.test(arg)) {
      const m = arg.match(/^--([^=]+)=(.*)$/s);
      assert(m != null);
      const [, key, value] = m;

      if (flags.bools[key]) {
        const booleanValue = value !== "false";
        setArg(key, booleanValue, arg);
      } else {
        setArg(key, value, arg);
      }
    } else if (
      /^--no-.+/.test(arg) && get(flags.negatable, arg.replace(/^--no-/, ""))
    ) {
      const m = arg.match(/^--no-(.+)/);
      assert(m != null);
      setArg(m[1], false, arg, false);
    } else if (/^--.+/.test(arg)) {
      const m = arg.match(/^--(.+)/);
      assert(m != null);
      const [, key] = m;
      const next = args[i + 1];
      if (
        next !== undefined &&
        !/^-/.test(next) &&
        !get(flags.bools, key) &&
        !flags.allBools &&
        (get(aliases, key) ? !aliasIsBoolean(key) : true)
      ) {
        setArg(key, next, arg);
        i++;
      } else if (/^(true|false)$/.test(next)) {
        setArg(key, next === "true", arg);
        i++;
      } else {
        setArg(key, get(flags.strings, key) ? "" : true, arg);
      }
    } else if (/^-[^-]+/.test(arg)) {
      const letters = arg.slice(1, -1).split("");

      let broken = false;
      for (let j = 0; j < letters.length; j++) {
        const next = arg.slice(j + 2);

        if (next === "-") {
          setArg(letters[j], next, arg);
          continue;
        }

        if (/[A-Za-z]/.test(letters[j]) && /=/.test(next)) {
          setArg(letters[j], next.split(/=(.+)/)[1], arg);
          broken = true;
          break;
        }

        if (
          /[A-Za-z]/.test(letters[j]) &&
          /-?\d+(\.\d*)?(e-?\d+)?$/.test(next)
        ) {
          setArg(letters[j], next, arg);
          broken = true;
          break;
        }

        if (letters[j + 1] && letters[j + 1].match(/\W/)) {
          setArg(letters[j], arg.slice(j + 2), arg);
          broken = true;
          break;
        } else {
          setArg(letters[j], get(flags.strings, letters[j]) ? "" : true, arg);
        }
      }

      const [key] = arg.slice(-1);
      if (!broken && key !== "-") {
        if (
          args[i + 1] &&
          !/^(-|--)[^-]/.test(args[i + 1]) &&
          !get(flags.bools, key) &&
          (get(aliases, key) ? !aliasIsBoolean(key) : true)
        ) {
          setArg(key, args[i + 1], arg);
          i++;
        } else if (args[i + 1] && /^(true|false)$/.test(args[i + 1])) {
          setArg(key, args[i + 1] === "true", arg);
          i++;
        } else {
          setArg(key, get(flags.strings, key) ? "" : true, arg);
        }
      }
    } else {
      if (!flags.unknownFn || flags.unknownFn(arg) !== false) {
        argv._.push(flags.strings["_"] ?? !isNumber(arg) ? arg : Number(arg));
      }
      if (stopEarly) {
        argv._.push(...args.slice(i + 1));
        break;
      }
    }
  }

  for (const [key, value] of Object.entries(defaults)) {
    if (!hasKey(argv, key.split("."))) {
      setKey(argv, key, value);

      if (aliases[key]) {
        for (const x of aliases[key]) {
          setKey(argv, x, value);
        }
      }
    }
  }

  for (const key of Object.keys(flags.bools)) {
    if (!hasKey(argv, key.split("."))) {
      const value = get(flags.collect, key) ? [] : false;
      setKey(
        argv,
        key,
        value,
        false,
      );
    }
  }

  for (const key of Object.keys(flags.strings)) {
    if (!hasKey(argv, key.split(".")) && get(flags.collect, key)) {
      setKey(
        argv,
        key,
        [],
        false,
      );
    }
  }

  if (doubleDash) {
    argv["--"] = [];
    for (const key of notFlags) {
      argv["--"].push(key);
    }
  } else {
    for (const key of notFlags) {
      argv._.push(key);
    }
  }

  return argv;
}
