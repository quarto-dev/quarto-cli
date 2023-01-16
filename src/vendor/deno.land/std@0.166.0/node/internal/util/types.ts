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
export { isCryptoKey, isKeyObject } from "../crypto/_keys.ts";

// https://tc39.es/ecma262/#sec-get-%typedarray%.prototype-@@tostringtag
const _getTypedArrayToStringTag = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array).prototype,
  Symbol.toStringTag,
)!.get!;

export function isArrayBufferView(value: unknown): boolean {
  return ArrayBuffer.isView(value);
}

export function isBigInt64Array(value: unknown): boolean {
  return _getTypedArrayToStringTag.call(value) === "BigInt64Array";
}

export function isBigUint64Array(value: unknown): boolean {
  return _getTypedArrayToStringTag.call(value) === "BigUint64Array";
}

export function isFloat32Array(value: unknown): boolean {
  return _getTypedArrayToStringTag.call(value) === "Float32Array";
}

export function isFloat64Array(value: unknown): boolean {
  return _getTypedArrayToStringTag.call(value) === "Float64Array";
}

export function isInt8Array(value: unknown): boolean {
  return _getTypedArrayToStringTag.call(value) === "Int8Array";
}

export function isInt16Array(value: unknown): boolean {
  return _getTypedArrayToStringTag.call(value) === "Int16Array";
}

export function isInt32Array(value: unknown): boolean {
  return _getTypedArrayToStringTag.call(value) === "Int32Array";
}

export function isTypedArray(value: unknown): boolean {
  return _getTypedArrayToStringTag.call(value) !== undefined;
}

export function isUint8Array(value: unknown): value is Uint8Array {
  return _getTypedArrayToStringTag.call(value) === "Uint8Array";
}

export function isUint8ClampedArray(value: unknown): boolean {
  return _getTypedArrayToStringTag.call(value) === "Uint8ClampedArray";
}

export function isUint16Array(value: unknown): boolean {
  return _getTypedArrayToStringTag.call(value) === "Uint16Array";
}

export function isUint32Array(value: unknown): boolean {
  return _getTypedArrayToStringTag.call(value) === "Uint32Array";
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
