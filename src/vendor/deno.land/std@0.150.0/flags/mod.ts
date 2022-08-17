// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
/**
 * CLI flag parser.
 *
 * This module is browser compatible.
 *
 * @module
 */
import { assert } from "../_util/assert.ts";

/** Combines recursivly all intersaction types and returns a new single type. */
type Id<T> = T extends Record<string, unknown>
  ? T extends infer U ? { [K in keyof U]: Id<U[K]> } : never
  : T;

/** Converts an union type `A | B | C` into an intersection type `A & B & C`. */
type UnionToIntersection<T> =
  (T extends unknown ? (args: T) => unknown : never) extends
    (args: infer R) => unknown ? R extends Record<string, unknown> ? R : never
    : never;

type BooleanType = boolean | string | undefined;
type StringType = string | undefined;
type ArgType = StringType | BooleanType;

type Collectable = string | undefined;
type Negatable = string | undefined;

type UseTypes<
  B extends BooleanType,
  S extends StringType,
  C extends Collectable,
> = undefined extends (
  & (false extends B ? undefined : B)
  & C
  & S
) ? false
  : true;

/**
 * Creates a record with all available flags with the corresponding type and
 * default type.
 */
type Values<
  B extends BooleanType,
  S extends StringType,
  C extends Collectable,
  N extends Negatable,
  D extends Record<string, unknown> | undefined,
  A extends Aliases | undefined,
> = UseTypes<B, S, C> extends true ? 
    & Record<string, unknown>
    & AddAliases<
      SpreadDefaults<
        & CollectValues<S, string, C, N>
        & RecursiveRequired<CollectValues<B, boolean, C>>
        & CollectUnknownValues<B, S, C, N>,
        DedotRecord<D>
      >,
      A
    >
  : // deno-lint-ignore no-explicit-any
  Record<string, any>;

type Aliases<T = string, V extends string = string> = Partial<
  Record<Extract<T, string>, V | ReadonlyArray<V>>
>;

type AddAliases<
  T,
  A extends Aliases | undefined,
> = { [K in keyof T as AliasName<K, A>]: T[K] };

type AliasName<
  K,
  A extends Aliases | undefined,
> = K extends keyof A
  ? string extends A[K] ? K : A[K] extends string ? K | A[K] : K
  : K;

/**
 * Spreads all default values of Record `D` into Record `A`
 * and makes default values required.
 *
 * **Example:**
 * `SpreadValues<{ foo?: boolean, bar?: number }, { foo: number }>`
 *
 * **Result:** `{ foo: boolan | number, bar?: number }`
 */
type SpreadDefaults<A, D> = D extends undefined ? A
  : A extends Record<string, unknown> ? 
      & Omit<A, keyof D>
      & {
        [K in keyof D]: K extends keyof A
          ? (A[K] & D[K] | D[K]) extends Record<string, unknown>
            ? NonNullable<SpreadDefaults<A[K], D[K]>>
          : D[K] | NonNullable<A[K]>
          : unknown;
      }
  : never;

/**
 * Defines the Record for the `default` option to add
 * auto suggestion support for IDE's.
 */
type Defaults<B extends BooleanType, S extends StringType> = Id<
  UnionToIntersection<
    & Record<string, unknown>
    // Dedotted auto suggestions: { foo: { bar: unknown } }
    & MapTypes<S, unknown>
    & MapTypes<B, unknown>
    // Flat auto suggestions: { "foo.bar": unknown }
    & MapDefaults<B>
    & MapDefaults<S>
  >
>;

type MapDefaults<T extends ArgType> = Partial<
  Record<T extends string ? T : string, unknown>
>;

type RecursiveRequired<T> = T extends Record<string, unknown> ? {
    [K in keyof T]-?: RecursiveRequired<T[K]>;
  }
  : T;

/** Same as `MapTypes` but also supports collectable options. */
type CollectValues<
  T extends ArgType,
  V,
  C extends Collectable,
  N extends Negatable = undefined,
> = UnionToIntersection<
  C extends string ? 
      & MapTypes<Exclude<T, C>, V, N>
      & (T extends undefined ? Record<never, never> : RecursiveRequired<
        MapTypes<Extract<C, T>, Array<V>, N>
      >)
    : MapTypes<T, V, N>
>;

/** Same as `Record` but also supports dotted and negatable options. */
type MapTypes<T extends ArgType, V, N extends Negatable = undefined> =
  undefined extends T ? Record<never, never>
    : T extends `${infer Name}.${infer Rest}` ? {
        [K in Name]?: MapTypes<
          Rest,
          V,
          N extends `${Name}.${infer Negate}` ? Negate : undefined
        >;
      }
    : T extends string ? Partial<Record<T, N extends T ? V | false : V>>
    : Record<never, never>;

type CollectUnknownValues<
  B extends BooleanType,
  S extends StringType,
  C extends Collectable,
  N extends Negatable,
> = B & S extends C ? Record<never, never>
  : DedotRecord<
    // Unknown collectable & non-negatable args.
    & Record<
      Exclude<
        Extract<Exclude<C, N>, string>,
        Extract<S | B, string>
      >,
      Array<unknown>
    >
    // Unknown collectable & negatable args.
    & Record<
      Exclude<
        Extract<Extract<C, N>, string>,
        Extract<S | B, string>
      >,
      Array<unknown> | false
    >
  >;

/** Converts `{ "foo.bar.baz": unknown }` into `{ foo: { bar: { baz: unknown } } }`. */
type DedotRecord<T> = Record<string, unknown> extends T ? T
  : T extends Record<string, unknown> ? UnionToIntersection<
      ValueOf<
        { [K in keyof T]: K extends string ? Dedot<K, T[K]> : never }
      >
    >
  : T;

type Dedot<T extends string, V> = T extends `${infer Name}.${infer Rest}`
  ? { [K in Name]: Dedot<Rest, V> }
  : { [K in T]: V };

type ValueOf<T> = T[keyof T];

/** The value returned from `parse`. */
export type Args<
  // deno-lint-ignore no-explicit-any
  A extends Record<string, unknown> = Record<string, any>,
  DD extends boolean | undefined = undefined,
> = Id<
  & A
  & {
    /** Contains all the arguments that didn't have an option associated with
     * them. */
    _: Array<string | number>;
  }
  & (boolean extends DD ? DoubleDash
    : true extends DD ? Required<DoubleDash>
    : Record<never, never>)
>;

type DoubleDash = {
  /** Contains all the arguments that appear after the double dash: "--". */
  "--"?: Array<string>;
};

/** The options for the `parse` call. */
export interface ParseOptions<
  B extends BooleanType = BooleanType,
  S extends StringType = StringType,
  C extends Collectable = Collectable,
  N extends Negatable = Negatable,
  D extends Record<string, unknown> | undefined =
    | Record<string, unknown>
    | undefined,
  A extends Aliases<string, string> | undefined =
    | Aliases<string, string>
    | undefined,
  DD extends boolean | undefined = boolean | undefined,
> {
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
  "--"?: DD;

  /** An object mapping string names to strings or arrays of string argument
   * names to use as aliases. */
  alias?: A;

  /** A boolean, string or array of strings to always treat as booleans. If
   * `true` will treat all double hyphenated arguments without equal signs as
   * `boolean` (e.g. affects `--foo`, not `-f` or `--foo=bar`) */
  boolean?: B | ReadonlyArray<Extract<B, string>>;

  /** An object mapping string argument names to default values. */
  default?: D & Defaults<B, S>;

  /** When `true`, populate the result `_` with everything after the first
   * non-option. */
  stopEarly?: boolean;

  /** A string or array of strings argument names to always treat as strings. */
  string?: S | ReadonlyArray<Extract<S, string>>;

  /** A string or array of strings argument names to always treat as arrays.
   * Collectable options can be used multiple times. All values will be
   * collected into one array. If a non-collectable option is used multiple
   * times, the last value is used. */
  collect?: C | ReadonlyArray<Extract<C, string>>;

  /** A string or array of strings argument names which can be negated
   * by prefixing them with `--no-`, like `--no-config`. */
  negatable?: N | ReadonlyArray<Extract<N, string>>;

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
  return hasOwn(o, key);
}

/** Take a set of command line arguments, optionally with a set of options, and
 * return an object representing the flags found in the passed arguments.
 *
 * By default, any arguments starting with `-` or `--` are considered boolean
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
export function parse<
  V extends Values<B, S, C, N, D, A>,
  DD extends boolean | undefined = undefined,
  B extends BooleanType = undefined,
  S extends StringType = undefined,
  C extends Collectable = undefined,
  N extends Negatable = undefined,
  D extends Record<string, unknown> | undefined = undefined,
  A extends Aliases<AK, AV> | undefined = undefined,
  AK extends string = string,
  AV extends string = string,
>(
  args: string[],
  {
    "--": doubleDash = false,
    alias = {} as NonNullable<A>,
    boolean = false,
    default: defaults = {} as D & Defaults<B, S>,
    stopEarly = false,
    string = [],
    collect = [],
    negatable = [],
    unknown = (i: string): unknown => i,
  }: ParseOptions<B, S, C, N, D, A, DD> = {},
): Args<V, DD> {
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
      const booleanArgs: ReadonlyArray<string> = typeof boolean === "string"
        ? [boolean]
        : boolean;

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
        aliases[key] = val as Array<string>;
      }
      for (const alias of getForce(aliases, key)) {
        aliases[alias] = [key].concat(aliases[key].filter((y) => alias !== y));
      }
    }
  }

  if (string !== undefined) {
    const stringArgs: ReadonlyArray<string> = typeof string === "string"
      ? [string]
      : string;

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
    const collectArgs: ReadonlyArray<string> = typeof collect === "string"
      ? [collect]
      : collect;

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
    const negatableArgs: ReadonlyArray<string> = typeof negatable === "string"
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

  return argv as Args<V, DD>;
}
