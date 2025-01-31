// Ported from js-yaml v3.13.1:
// https://github.com/nodeca/js-yaml/commit/665aadda42349dcae869f12040d9b10ef18d12da
// Copyright 2011-2015 by Vitaly Puzrin. All rights reserved. MIT license.
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

// deno-lint-ignore no-explicit-any
export type Any = any;

export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean" || value instanceof Boolean;
}

export function isNull(value: unknown): value is null {
  return value === null;
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

export function repeat(str: string, count: number): string {
  let result = "";

  for (let cycle = 0; cycle < count; cycle++) {
    result += str;
  }

  return result;
}

export function isNegativeZero(i: number): boolean {
  return i === 0 && Number.NEGATIVE_INFINITY === 1 / i;
}

export interface ArrayObject<T = Any> {
  [P: string]: T;
}
