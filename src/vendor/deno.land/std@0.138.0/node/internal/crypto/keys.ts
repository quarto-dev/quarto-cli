// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright Joyent and Node contributors. All rights reserved. MIT license.
import { kKeyObject } from "./util.mjs";
const kKeyType = Symbol("kKeyType");

// deno-lint-ignore no-explicit-any
export function isKeyObject(obj: any) {
  return obj != null && obj[kKeyType] !== undefined;
}

// deno-lint-ignore no-explicit-any
export function isCryptoKey(obj: any) {
  return obj != null && obj[kKeyObject] !== undefined;
}
