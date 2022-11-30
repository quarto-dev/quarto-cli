// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright Joyent, Inc. and Node.js contributors. All rights reserved. MIT license.

import {
  validateFunction,
  validateInteger,
  validateString,
} from "../validators.mjs";
import {
  ERR_INVALID_ARG_TYPE,
  ERR_OUT_OF_RANGE,
  hideStackFrames,
} from "../errors.ts";
import { toBuf, validateByteSource } from "./util.ts";
import { createSecretKey, isKeyObject, KeyObject } from "./keys.ts";
import type { BinaryLike } from "./types.ts";
import { kMaxLength } from "../buffer.mjs";
import { isAnyArrayBuffer, isArrayBufferView } from "../util/types.ts";
import { notImplemented } from "../../_utils.ts";

const validateParameters = hideStackFrames((hash, key, salt, info, length) => {
  key = prepareKey(key);
  salt = toBuf(salt);
  info = toBuf(info);

  validateString(hash, "digest");
  validateByteSource(salt, "salt");
  validateByteSource(info, "info");

  validateInteger(length, "length", 0, kMaxLength);

  if (info.byteLength > 1024) {
    throw new ERR_OUT_OF_RANGE(
      "info",
      "must not contain more than 1024 bytes",
      info.byteLength,
    );
  }

  return {
    hash,
    key,
    salt,
    info,
    length,
  };
});

function prepareKey(key: BinaryLike | KeyObject) {
  if (isKeyObject(key)) {
    return key;
  }

  if (isAnyArrayBuffer(key)) {
    return createSecretKey(new Uint8Array(key as unknown as ArrayBufferLike));
  }

  key = toBuf(key as string);

  if (!isArrayBufferView(key)) {
    throw new ERR_INVALID_ARG_TYPE(
      "ikm",
      [
        "string",
        "SecretKeyObject",
        "ArrayBuffer",
        "TypedArray",
        "DataView",
        "Buffer",
      ],
      key,
    );
  }

  return createSecretKey(key);
}

export function hkdf(
  hash: string,
  key: BinaryLike | KeyObject,
  salt: BinaryLike,
  info: BinaryLike,
  length: number,
  callback: (err: Error | null, derivedKey: ArrayBuffer) => void,
) {
  ({ hash, key, salt, info, length } = validateParameters(
    hash,
    key,
    salt,
    info,
    length,
  ));

  validateFunction(callback, "callback");

  notImplemented("crypto.hkdf");
}

export function hkdfSync(
  hash: string,
  key: BinaryLike | KeyObject,
  salt: BinaryLike,
  info: BinaryLike,
  length: number,
) {
  ({ hash, key, salt, info, length } = validateParameters(
    hash,
    key,
    salt,
    info,
    length,
  ));

  notImplemented("crypto.hkdfSync");
}

export default {
  hkdf,
  hkdfSync,
};
