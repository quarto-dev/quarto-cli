// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
//
// Adapted from Node.js. Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

import * as bindingTypes from "../../internal_binding/types.ts";
export { isCryptoKey, isKeyObject } from "../crypto/keys.ts";

const _toString = Object.prototype.toString;

const _isObjectLike = (value: unknown): boolean =>
  value !== null && typeof value === "object";

export function isArrayBufferView(value: unknown): boolean {
  return ArrayBuffer.isView(value);
}

export function isBigInt64Array(value: unknown): boolean {
  return (
    _isObjectLike(value) && _toString.call(value) === "[object BigInt64Array]"
  );
}

export function isBigUint64Array(value: unknown): boolean {
  return (
    _isObjectLike(value) && _toString.call(value) === "[object BigUint64Array]"
  );
}

export function isFloat32Array(value: unknown): boolean {
  return (
    _isObjectLike(value) && _toString.call(value) === "[object Float32Array]"
  );
}

export function isFloat64Array(value: unknown): boolean {
  return (
    _isObjectLike(value) && _toString.call(value) === "[object Float64Array]"
  );
}

export function isInt8Array(value: unknown): boolean {
  return _isObjectLike(value) && _toString.call(value) === "[object Int8Array]";
}

export function isInt16Array(value: unknown): boolean {
  return (
    _isObjectLike(value) && _toString.call(value) === "[object Int16Array]"
  );
}

export function isInt32Array(value: unknown): boolean {
  return (
    _isObjectLike(value) && _toString.call(value) === "[object Int32Array]"
  );
}

// Adapted from Lodash
export function isTypedArray(value: unknown): boolean {
  /** Used to match `toStringTag` values of typed arrays. */
  const reTypedTag =
    /^\[object (?:Float(?:32|64)|(?:Int|Uint)(?:8|16|32)|Uint8Clamped)Array\]$/;
  return _isObjectLike(value) && reTypedTag.test(_toString.call(value));
}

export function isUint8Array(value: unknown): value is Uint8Array {
  return (
    _isObjectLike(value) && _toString.call(value) === "[object Uint8Array]"
  );
}

export function isUint8ClampedArray(value: unknown): boolean {
  return (
    _isObjectLike(value) &&
    _toString.call(value) === "[object Uint8ClampedArray]"
  );
}

export function isUint16Array(value: unknown): boolean {
  return (
    _isObjectLike(value) && _toString.call(value) === "[object Uint16Array]"
  );
}

export function isUint32Array(value: unknown): boolean {
  return (
    _isObjectLike(value) && _toString.call(value) === "[object Uint32Array]"
  );
}

export const {
  // isExternal,
  isDate,
  isArgumentsObject,
  isBigIntObject,
  isBooleanObject,
  isNumberObject,
  isStringObject,
  isSymbolObject,
  isNativeError,
  isRegExp,
  isAsyncFunction,
  isGeneratorFunction,
  isGeneratorObject,
  isPromise,
  isMap,
  isSet,
  isMapIterator,
  isSetIterator,
  isWeakMap,
  isWeakSet,
  isArrayBuffer,
  isDataView,
  isSharedArrayBuffer,
  // isProxy,
  isModuleNamespaceObject,
  isAnyArrayBuffer,
  isBoxedPrimitive,
} = bindingTypes;
