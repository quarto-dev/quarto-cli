// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import {
  BigIntStats,
  CFISBIS,
  statCallback,
  statCallbackBigInt,
  statOptions,
  Stats,
} from "./_fs_stat.ts";
import { promisify } from "../internal/util.mjs";

export function lstat(path: string | URL, callback: statCallback): void;
export function lstat(
  path: string | URL,
  options: { bigint: false },
  callback: statCallback,
): void;
export function lstat(
  path: string | URL,
  options: { bigint: true },
  callback: statCallbackBigInt,
): void;
export function lstat(
  path: string | URL,
  optionsOrCallback: statCallback | statCallbackBigInt | statOptions,
  maybeCallback?: statCallback | statCallbackBigInt,
) {
  const callback =
    (typeof optionsOrCallback === "function"
      ? optionsOrCallback
      : maybeCallback) as (
        ...args: [Error] | [null, BigIntStats | Stats]
      ) => void;
  const options = typeof optionsOrCallback === "object"
    ? optionsOrCallback
    : { bigint: false };

  if (!callback) throw new Error("No callback function supplied");

  Deno.lstat(path).then(
    (stat) => callback(null, CFISBIS(stat, options.bigint)),
    (err) => callback(err),
  );
}

export const lstatPromise = promisify(lstat) as (
  & ((path: string | URL) => Promise<Stats>)
  & ((path: string | URL, options: { bigint: false }) => Promise<Stats>)
  & ((path: string | URL, options: { bigint: true }) => Promise<BigIntStats>)
);

export function lstatSync(path: string | URL): Stats;
export function lstatSync(
  path: string | URL,
  options: { bigint: false },
): Stats;
export function lstatSync(
  path: string | URL,
  options: { bigint: true },
): BigIntStats;
export function lstatSync(
  path: string | URL,
  options?: statOptions,
): Stats | BigIntStats {
  const origin = Deno.lstatSync(path);
  return CFISBIS(origin, options?.bigint || false);
}
