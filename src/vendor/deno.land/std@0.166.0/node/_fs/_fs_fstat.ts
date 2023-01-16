// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import {
  BigIntStats,
  CFISBIS,
  statCallback,
  statCallbackBigInt,
  statOptions,
  Stats,
} from "./_fs_stat.ts";

export function fstat(fd: number, callback: statCallback): void;
export function fstat(
  fd: number,
  options: { bigint: false },
  callback: statCallback,
): void;
export function fstat(
  fd: number,
  options: { bigint: true },
  callback: statCallbackBigInt,
): void;
export function fstat(
  fd: number,
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

  Deno.fstat(fd).then(
    (stat) => callback(null, CFISBIS(stat, options.bigint)),
    (err) => callback(err),
  );
}

export function fstatSync(fd: number): Stats;
export function fstatSync(
  fd: number,
  options: { bigint: false },
): Stats;
export function fstatSync(
  fd: number,
  options: { bigint: true },
): BigIntStats;
export function fstatSync(
  fd: number,
  options?: statOptions,
): Stats | BigIntStats {
  const origin = Deno.fstatSync(fd);
  return CFISBIS(origin, options?.bigint || false);
}
