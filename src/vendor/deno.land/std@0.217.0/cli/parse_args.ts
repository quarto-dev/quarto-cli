// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/**
 * Command line arguments parser based on
 * {@link https://github.com/minimistjs/minimist | minimist}.
 *
 * This module is browser compatible.
 *
 * @example
 * ```ts
 * import { parseArgs } from "https://deno.land/std@$STD_VERSION/cli/parse_args.ts";
 *
 * console.dir(parseArgs(Deno.args));
 * ```
 *
 * @module
 */
import { assert } from "../assert/assert.ts";

/** Combines recursively all intersection types and returns a new single type. */
type Id<TRecord> = TRecord extends Record<string, unknown>
  ? TRecord extends infer InferredRecord
    ? { [Key in keyof InferredRecord]: Id<InferredRecord[Key]> }
  : never
  : TRecord;

/** Converts a union type `A | B | C` into an intersection type `A & B & C`. */
type UnionToIntersection<TValue> =
  (TValue extends unknown ? (args: TValue) => unknown : never) extends
    (args: infer R) => unknown ? R extends Record<string, unknown> ? R : never
    : never;

type BooleanType = boolean | string | undefined;
type StringType = string | undefined;
type ArgType = StringType | BooleanType;

type Collectable = string | undefined;
type Negatable = string | undefined;

type UseTypes<
  TBooleans extends BooleanType,
  TStrings extends StringType,
  TCollectable extends Collectable,
> = undefined extends (
  & (false extends TBooleans ? undefined : TBooleans)
  & TCollectable
  & TStrings
) ? false
  : true;

/**
 * Creates a record with all available flags with the corresponding type and
 * default type.
 */
type Values<
  TBooleans extends BooleanType,
  TStrings extends StringType,
  TCollectable extends Collectable,
  TNegatable extends Negatable,
  TDefault extends Record<string, unknown> | undefined,
  TAliases extends Aliases | undefined,
> = UseTypes<TBooleans, TStrings, TCollectable> extends true ?
    & Record<string, unknown>
    & AddAliases<
      SpreadDefaults<
        & CollectValues<TStrings, string, TCollectable, TNegatable>
        & RecursiveRequired<CollectValues<TBooleans, boolean, TCollectable>>
        & CollectUnknownValues<
          TBooleans,
          TStrings,
          TCollectable,
          TNegatable
        >,
        DedotRecord<TDefault>
      >,
      TAliases
    >
  // deno-lint-ignore no-explicit-any
  : Record<string, any>;

type Aliases<TArgNames = string, TAliasNames extends string = string> = Partial<
  Record<Extract<TArgNames, string>, TAliasNames | ReadonlyArray<TAliasNames>>
>;

type AddAliases<
  TArgs,
  TAliases extends Aliases | undefined,
> = {
  [TArgName in keyof TArgs as AliasNames<TArgName, TAliases>]: TArgs[TArgName];
};

type AliasNames<
  TArgName,
  TAliases extends Aliases | undefined,
> = TArgName extends keyof TAliases
  ? string extends TAliases[TArgName] ? TArgName
  : TAliases[TArgName] extends string ? TArgName | TAliases[TArgName]
  : TAliases[TArgName] extends Array<string>
    ? TArgName | TAliases[TArgName][number]
  : TArgName
  : TArgName;

/**
 * Spreads all default values of Record `TDefaults` into Record `TArgs`
 * and makes default values required.
 *
 * **Example:**
 * `SpreadValues<{ foo?: boolean, bar?: number }, { foo: number }>`
 *
 * **Result:** `{ foo: boolean | number, bar?: number }`
 */
type SpreadDefaults<TArgs, TDefaults> = TDefaults extends undefined ? TArgs
  : TArgs extends Record<string, unknown> ?
      & Omit<TArgs, keyof TDefaults>
      & {
        [Default in keyof TDefaults]: Default extends keyof TArgs
          ? (TArgs[Default] & TDefaults[Default] | TDefaults[Default]) extends
            Record<string, unknown>
            ? NonNullable<SpreadDefaults<TArgs[Default], TDefaults[Default]>>
          : TDefaults[Default] | NonNullable<TArgs[Default]>
          : unknown;
      }
  : never;

/**
 * Defines the Record for the `default` option to add
 * auto-suggestion support for IDE's.
 */
type Defaults<TBooleans extends BooleanType, TStrings extends StringType> = Id<
  UnionToIntersection<
    & Record<string, unknown>
    // Dedotted auto suggestions: { foo: { bar: unknown } }
    & MapTypes<TStrings, unknown>
    & MapTypes<TBooleans, unknown>
    // Flat auto suggestions: { "foo.bar": unknown }
    & MapDefaults<TBooleans>
    & MapDefaults<TStrings>
  >
>;

type MapDefaults<TArgNames extends ArgType> = Partial<
  Record<TArgNames extends string ? TArgNames : string, unknown>
>;

type RecursiveRequired<TRecord> = TRecord extends Record<string, unknown> ? {
    [Key in keyof TRecord]-?: RecursiveRequired<TRecord[Key]>;
  }
  : TRecord;

/** Same as `MapTypes` but also supports collectable options. */
type CollectValues<
  TArgNames extends ArgType,
  TType,
  TCollectable extends Collectable,
  TNegatable extends Negatable = undefined,
> = UnionToIntersection<
  Extract<TArgNames, TCollectable> extends string ?
      & (Exclude<TArgNames, TCollectable> extends never ? Record<never, never>
        : MapTypes<Exclude<TArgNames, TCollectable>, TType, TNegatable>)
      & (Extract<TArgNames, TCollectable> extends never ? Record<never, never>
        : RecursiveRequired<
          MapTypes<Extract<TArgNames, TCollectable>, Array<TType>, TNegatable>
        >)
    : MapTypes<TArgNames, TType, TNegatable>
>;

/** Same as `Record` but also supports dotted and negatable options. */
type MapTypes<
  TArgNames extends ArgType,
  TType,
  TNegatable extends Negatable = undefined,
> = undefined extends TArgNames ? Record<never, never>
  : TArgNames extends `${infer Name}.${infer Rest}` ? {
      [Key in Name]?: MapTypes<
        Rest,
        TType,
        TNegatable extends `${Name}.${infer Negate}` ? Negate : undefined
      >;
    }
  : TArgNames extends string ? Partial<
      Record<TArgNames, TNegatable extends TArgNames ? TType | false : TType>
    >
  : Record<never, never>;

type CollectUnknownValues<
  TBooleans extends BooleanType,
  TStrings extends StringType,
  TCollectable extends Collectable,
  TNegatable extends Negatable,
> = UnionToIntersection<
  TCollectable extends TBooleans & TStrings ? Record<never, never>
    : DedotRecord<
      // Unknown collectable & non-negatable args.
      & Record<
        Exclude<
          Extract<Exclude<TCollectable, TNegatable>, string>,
          Extract<TStrings | TBooleans, string>
        >,
        Array<unknown>
      >
      // Unknown collectable & negatable args.
      & Record<
        Exclude<
          Extract<Extract<TCollectable, TNegatable>, string>,
          Extract<TStrings | TBooleans, string>
        >,
        Array<unknown> | false
      >
    >
>;

/** Converts `{ "foo.bar.baz": unknown }` into `{ foo: { bar: { baz: unknown } } }`. */
type DedotRecord<TRecord> = Record<string, unknown> extends TRecord ? TRecord
  : TRecord extends Record<string, unknown> ? UnionToIntersection<
      ValueOf<
        {
          [Key in keyof TRecord]: Key extends string ? Dedot<Key, TRecord[Key]>
            : never;
        }
      >
    >
  : TRecord;

type Dedot<TKey extends string, TValue> = TKey extends
  `${infer Name}.${infer Rest}` ? { [Key in Name]: Dedot<Rest, TValue> }
  : { [Key in TKey]: TValue };

type ValueOf<TValue> = TValue[keyof TValue];

/** The value returned from `parseArgs`. */
export type Args<
  // deno-lint-ignore no-explicit-any
  TArgs extends Record<string, unknown> = Record<string, any>,
  TDoubleDash extends boolean | undefined = undefined,
> = Id<
  & TArgs
  & {
    /** Contains all the arguments that didn't have an option associated with
     * them. */
    _: Array<string | number>;
  }
  & (boolean extends TDoubleDash ? DoubleDash
    : true extends TDoubleDash ? Required<DoubleDash>
    : Record<never, never>)
>;

type DoubleDash = {
  /** Contains all the arguments that appear after the double dash: "--". */
  "--"?: Array<string>;
};

/** The options for the `parseArgs` call. */
export interface ParseOptions<
  TBooleans extends BooleanType = BooleanType,
  TStrings extends StringType = StringType,
  TCollectable extends Collectable = Collectable,
  TNegatable extends Negatable = Negatable,
  TDefault extends Record<string, unknown> | undefined =
    | Record<string, unknown>
    | undefined,
  TAliases extends Aliases | undefined = Aliases | undefined,
  TDoubleDash extends boolean | undefined = boolean | undefined,
> {
  /**
   * When `true`, populate the result `_` with everything before the `--` and
   * the result `['--']` with everything after the `--`.
   *
   * @default {false}
   *
   *  @example
   * ```ts
   * // $ deno run example.ts -- a arg1
   * import { parseArgs } from "https://deno.land/std@$STD_VERSION/cli/parse_args.ts";
   * console.dir(parseArgs(Deno.args, { "--": false }));
   * // output: { _: [ "a", "arg1" ] }
   * console.dir(parseArgs(Deno.args, { "--": true }));
   * // output: { _: [], --: [ "a", "arg1" ] }
   * ```
   */
  "--"?: TDoubleDash;

  /**
   * An object mapping string names to strings or arrays of string argument
   * names to use as aliases.
   */
  alias?: TAliases;

  /**
   * A boolean, string or array of strings to always treat as booleans. If
   * `true` will treat all double hyphenated arguments without equal signs as
   * `boolean` (e.g. affects `--foo`, not `-f` or `--foo=bar`).
   *  All `boolean` arguments will be set to `false` by default.
   */
  boolean?: TBooleans | ReadonlyArray<Extract<TBooleans, string>>;

  /** An object mapping string argument names to default values. */
  default?: TDefault & Defaults<TBooleans, TStrings>;

  /**
   * When `true`, populate the result `_` with everything after the first
   * non-option.
   */
  stopEarly?: boolean;

  /** A string or array of strings argument names to always treat as strings. */
  string?: TStrings | ReadonlyArray<Extract<TStrings, string>>;

  /**
   * A string or array of strings argument names to always treat as arrays.
   * Collectable options can be used multiple times. All values will be
   * collected into one array. If a non-collectable option is used multiple
   * times, the last value is used.
   * All Collectable arguments will be set to `[]` by default.
   */
  collect?: TCollectable | ReadonlyArray<Extract<TCollectable, string>>;

  /**
   * A string or array of strings argument names which can be negated
   * by prefixing them with `--no-`, like `--no-config`.
   */
  negatable?: TNegatable | ReadonlyArray<Extract<TNegatable, string>>;

  /**
   * A function which is invoked with a command line parameter not defined in
   * the `options` configuration object. If the function returns `false`, the
   * unknown option is not added to `parsedArgs`.
   */
  unknown?: (arg: string, key?: string, value?: unknown) => unknown;
}

interface NestedMapping {
  [key: string]: NestedMapping | unknown;
}

function isNumber(x: unknown): boolean {
  if (typeof x === "number") return true;
  if (/^0x[0-9a-f]+$/i.test(String(x))) return true;
  return /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(e[-+]?\d+)?$/.test(String(x));
}

function setNested(
  object: NestedMapping,
  keys: string[],
  value: unknown,
  collect = false,
) {
  keys.slice(0, -1).forEach((key) => {
    object[key] ??= {};
    object = object[key] as NestedMapping;
  });

  const key = keys[keys.length - 1];

  if (collect) {
    const v = object[key];
    if (Array.isArray(v)) {
      v.push(value);
      return;
    }

    value = v ? [v, value] : [value];
  }

  object[key] = value;
}

function hasNested(object: NestedMapping, keys: string[]): boolean {
  keys = [...keys];
  const lastKey = keys.pop();
  if (!lastKey) return false;
  for (const key of keys) {
    if (!object[key]) return false;
    object = object[key] as NestedMapping;
  }
  return Object.hasOwn(object, lastKey);
}

function aliasIsBoolean(
  aliasMap: Map<string, Set<string>>,
  booleanSet: Set<string>,
  key: string,
): boolean {
  const set = aliasMap.get(key);
  if (set === undefined) return false;
  for (const alias of set) if (booleanSet.has(alias)) return true;
  return false;
}

function isBooleanString(value: string) {
  return value === "true" || value === "false";
}

function parseBooleanString(value: unknown) {
  return value !== "false";
}

const FLAG_REGEXP =
  /^(?:-(?:(?<doubleDash>-)(?<negated>no-)?)?)(?<key>.+?)(?:=(?<value>.+?))?$/s;

/**
 * Take a set of command line arguments, optionally with a set of options, and
 * return an object representing the flags found in the passed arguments.
 *
 * By default, any arguments starting with `-` or `--` are considered boolean
 * flags. If the argument name is followed by an equal sign (`=`) it is
 * considered a key-value pair. Any arguments which could not be parsed are
 * available in the `_` property of the returned object.
 *
 * By default, the flags module tries to determine the type of all arguments
 * automatically and the return type of the `parseArgs` method will have an index
 * signature with `any` as value (`{ [x: string]: any }`).
 *
 * If the `string`, `boolean` or `collect` option is set, the return value of
 * the `parseArgs` method will be fully typed and the index signature of the return
 * type will change to `{ [x: string]: unknown }`.
 *
 * Any arguments after `'--'` will not be parsed and will end up in `parsedArgs._`.
 *
 * Numeric-looking arguments will be returned as numbers unless `options.string`
 * or `options.boolean` is set for that argument name.
 *
 * @example
 * ```ts
 * import { parseArgs } from "https://deno.land/std@$STD_VERSION/cli/parse_args.ts";
 * const parsedArgs = parseArgs(Deno.args);
 * ```
 *
 * @example
 * ```ts
 * import { parseArgs } from "https://deno.land/std@$STD_VERSION/cli/parse_args.ts";
 * const parsedArgs = parseArgs(["--foo", "--bar=baz", "./quux.txt"]);
 * // parsedArgs: { foo: true, bar: "baz", _: ["./quux.txt"] }
 * ```
 */
export function parseArgs<
  TArgs extends Values<
    TBooleans,
    TStrings,
    TCollectable,
    TNegatable,
    TDefaults,
    TAliases
  >,
  TDoubleDash extends boolean | undefined = undefined,
  TBooleans extends BooleanType = undefined,
  TStrings extends StringType = undefined,
  TCollectable extends Collectable = undefined,
  TNegatable extends Negatable = undefined,
  TDefaults extends Record<string, unknown> | undefined = undefined,
  TAliases extends Aliases<TAliasArgNames, TAliasNames> | undefined = undefined,
  TAliasArgNames extends string = string,
  TAliasNames extends string = string,
>(
  args: string[],
  {
    "--": doubleDash = false,
    alias = {} as NonNullable<TAliases>,
    boolean = false,
    default: defaults = {} as TDefaults & Defaults<TBooleans, TStrings>,
    stopEarly = false,
    string = [],
    collect = [],
    negatable = [],
    unknown: unknownFn = (i: string): unknown => i,
  }: ParseOptions<
    TBooleans,
    TStrings,
    TCollectable,
    TNegatable,
    TDefaults,
    TAliases,
    TDoubleDash
  > = {},
): Args<TArgs, TDoubleDash> {
  const aliasMap: Map<string, Set<string>> = new Map();
  const booleanSet = new Set<string>();
  const stringSet = new Set<string>();
  const collectSet = new Set<string>();
  const negatableSet = new Set<string>();

  let allBools = false;

  if (alias) {
    for (const key in alias) {
      const val = (alias as Record<string, unknown>)[key];
      assert(val !== undefined);
      const aliases = Array.isArray(val) ? val : [val];
      aliasMap.set(key, new Set(aliases));
      const set = new Set([key, ...aliases]);
      aliases.forEach((alias) => aliasMap.set(alias, set));
    }
  }

  if (boolean) {
    if (typeof boolean === "boolean") {
      allBools = boolean;
    } else {
      const booleanArgs = Array.isArray(boolean) ? boolean : [boolean];
      for (const key of booleanArgs.filter(Boolean)) {
        booleanSet.add(key);
        aliasMap.get(key)?.forEach((al) => {
          booleanSet.add(al);
        });
      }
    }
  }

  if (string) {
    const stringArgs = Array.isArray(string) ? string : [string];
    for (const key of stringArgs.filter(Boolean)) {
      stringSet.add(key);
      aliasMap.get(key)?.forEach((al) => stringSet.add(al));
    }
  }

  if (collect) {
    const collectArgs = Array.isArray(collect) ? collect : [collect];
    for (const key of collectArgs.filter(Boolean)) {
      collectSet.add(key);
      aliasMap.get(key)?.forEach((al) => collectSet.add(al));
    }
  }

  if (negatable) {
    const negatableArgs = Array.isArray(negatable) ? negatable : [negatable];
    for (const key of negatableArgs.filter(Boolean)) {
      negatableSet.add(key);
      aliasMap.get(key)?.forEach((alias) => negatableSet.add(alias));
    }
  }

  const argv: Args = { _: [] };

  function setArgument(
    key: string,
    value: string | number | boolean,
    arg: string,
    collect: boolean,
  ) {
    if (
      !booleanSet.has(key) &&
      !stringSet.has(key) &&
      !aliasMap.has(key) &&
      !(allBools && /^--[^=]+$/.test(arg)) &&
      unknownFn?.(arg, key, value) === false
    ) {
      return;
    }
    if (typeof value === "string" && !stringSet.has(key)) {
      value = isNumber(value) ? Number(value) : value;
    }

    const collectable = collect && collectSet.has(key);
    setNested(argv, key.split("."), value, collectable);
    aliasMap.get(key)?.forEach((key) =>
      setNested(argv, key.split("."), value, collectable)
    );
  }

  let notFlags: string[] = [];

  // all args after "--" are not parsed
  const index = args.indexOf("--");
  if (index !== -1) {
    notFlags = args.slice(index + 1);
    args = args.slice(0, index);
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    const groups = arg.match(FLAG_REGEXP)?.groups;

    if (groups) {
      const { doubleDash, negated } = groups;
      let key = groups.key;
      let value: string | number | boolean = groups.value;

      if (doubleDash) {
        if (value) {
          if (booleanSet.has(key)) value = parseBooleanString(value);
          setArgument(key, value, arg, true);
          continue;
        }

        if (negated) {
          if (negatableSet.has(key)) {
            setArgument(key, false, arg, false);
            continue;
          }
          key = `no-${key}`;
        }

        const next = args[i + 1];

        if (
          !booleanSet.has(key) &&
          !allBools &&
          next &&
          !/^-/.test(next) &&
          (aliasMap.get(key)
            ? !aliasIsBoolean(aliasMap, booleanSet, key)
            : true)
        ) {
          value = next;
          i++;
          setArgument(key, value, arg, true);
          continue;
        }

        if (isBooleanString(next)) {
          value = parseBooleanString(next);
          i++;
          setArgument(key, value, arg, true);
          continue;
        }

        value = stringSet.has(key) ? "" : true;
        setArgument(key, value, arg, true);
        continue;
      }
      const letters = arg.slice(1, -1).split("");

      let broken = false;
      for (const [j, letter] of letters.entries()) {
        const next = arg.slice(j + 2);

        if (next === "-") {
          setArgument(letter, next, arg, true);
          continue;
        }

        if (/[A-Za-z]/.test(letter) && /=/.test(next)) {
          setArgument(letter, next.split(/=(.+)/)[1], arg, true);
          broken = true;
          break;
        }

        if (
          /[A-Za-z]/.test(letter) &&
          /-?\d+(\.\d*)?(e-?\d+)?$/.test(next)
        ) {
          setArgument(letter, next, arg, true);
          broken = true;
          break;
        }

        if (letters[j + 1] && letters[j + 1].match(/\W/)) {
          setArgument(letter, arg.slice(j + 2), arg, true);
          broken = true;
          break;
        }
        setArgument(
          letter,
          stringSet.has(letter) ? "" : true,
          arg,
          true,
        );
      }

      key = arg.slice(-1);
      if (!broken && key !== "-") {
        const nextArg = args[i + 1];
        if (
          nextArg &&
          !/^(-|--)[^-]/.test(nextArg) &&
          !booleanSet.has(key) &&
          (aliasMap.get(key)
            ? !aliasIsBoolean(aliasMap, booleanSet, key)
            : true)
        ) {
          setArgument(key, nextArg, arg, true);
          i++;
        } else if (nextArg && isBooleanString(nextArg)) {
          const value = parseBooleanString(nextArg);
          setArgument(key, value, arg, true);
          i++;
        } else {
          setArgument(key, stringSet.has(key) ? "" : true, arg, true);
        }
      }
      continue;
    }

    if (unknownFn?.(arg) !== false) {
      argv._.push(
        stringSet.has("_") || !isNumber(arg) ? arg : Number(arg),
      );
    }

    if (stopEarly) {
      argv._.push(...args.slice(i + 1));
      break;
    }
  }

  for (const [key, value] of Object.entries(defaults)) {
    const keys = key.split(".");
    if (!hasNested(argv, keys)) {
      setNested(argv, keys, value);
      aliasMap.get(key)?.forEach((key) =>
        setNested(argv, key.split("."), value)
      );
    }
  }

  for (const key of booleanSet.keys()) {
    const keys = key.split(".");
    if (!hasNested(argv, keys)) {
      const value = collectSet.has(key) ? [] : false;
      setNested(argv, keys, value);
    }
  }

  for (const key of stringSet.keys()) {
    const keys = key.split(".");
    if (!hasNested(argv, keys) && collectSet.has(key)) {
      setNested(argv, keys, []);
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

  return argv as Args<TArgs, TDoubleDash>;
}
