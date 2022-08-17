// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// TODO(Soremwar)
// This implementation has an unreliable indexOf and includes implementation
// It also lacks the resolveObjectURL, transcode and INSPECT_MAX_BYTES exports

// Copyright Joyent and Node contributors. All rights reserved. MIT license.
// Copyright Feross Aboukhadijeh, and other contributors. All rights reserved. MIT license.

import { codes } from "./internal/error_codes.ts";
import { isAnyArrayBuffer, isArrayBufferView } from "./internal/util/types.ts";
import { normalizeEncoding } from "./internal/util.mjs";
import {
  _copyActual,
  _writeUInt32BE,
  _writeUInt32LE,
  bigEndian,
  boundsError,
  byteLengthUtf8,
  encodingOps,
  encodingsMap,
  getEncodingOps,
  readDoubleBackwards,
  readDoubleForwards,
  readFloatBackwards,
  readFloatForwards,
  readInt24BE,
  readInt24LE,
  readInt40BE,
  readInt40LE,
  readInt48BE,
  readInt48LE,
  readUInt16BE,
  readUInt24BE,
  readUInt24LE,
  readUInt32BE,
  readUInt40BE,
  readUInt40LE,
  readUInt48BE,
  readUInt48LE,
  toInteger,
  validateNumber,
  validateOffset,
  writeDoubleBackwards,
  writeDoubleForwards,
  writeFloatBackwards,
  writeFloatForwards,
  // deno-lint-ignore camelcase
  writeU_Int16BE,
  // deno-lint-ignore camelcase
  writeU_Int16LE,
  // deno-lint-ignore camelcase
  writeU_Int24BE,
  // deno-lint-ignore camelcase
  writeU_Int24LE,
  // deno-lint-ignore camelcase
  writeU_Int32BE,
  // deno-lint-ignore camelcase
  writeU_Int32LE,
  // deno-lint-ignore camelcase
  writeU_Int40BE,
  // deno-lint-ignore camelcase
  writeU_Int40LE,
  // deno-lint-ignore camelcase
  writeU_Int48BE,
  // deno-lint-ignore camelcase
  writeU_Int48LE,
  // deno-lint-ignore camelcase
  writeU_Int8,
} from "./internal/buffer.mjs";
import {
  asciiToBytes,
  base64ToBytes,
  base64UrlToBytes,
  bytesToAscii,
  bytesToUtf16le,
  hexToBytes,
  utf16leToBytes,
} from "./internal_binding/_utils.ts";
import { indexOfBuffer, indexOfNumber } from "./internal_binding/buffer.ts";
import { validateBuffer } from "./internal/validators.mjs";
import { isUint8Array } from "./internal/util/types.ts";
import * as base64 from "../encoding/base64.ts";
import * as base64url from "../encoding/base64url.ts";

export const kMaxLength = 2147483647;
export const kStringMaxLength = 536870888;
const MAX_UINT32 = 2 ** 32;

const customInspectSymbol =
  typeof Symbol === "function" && typeof Symbol["for"] === "function"
    ? Symbol["for"]("nodejs.util.inspect.custom")
    : null;

const INSPECT_MAX_BYTES = 50;

export const constants = {
  MAX_LENGTH: kMaxLength,
  MAX_STRING_LENGTH: kStringMaxLength,
};

Object.defineProperty(Buffer.prototype, "parent", {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) {
      return void 0;
    }
    return this.buffer;
  },
});

Object.defineProperty(Buffer.prototype, "offset", {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) {
      return void 0;
    }
    return this.byteOffset;
  },
});

function createBuffer(length) {
  if (length > kMaxLength) {
    throw new RangeError(
      'The value "' + length + '" is invalid for option "size"',
    );
  }
  const buf = new Uint8Array(length);
  Object.setPrototypeOf(buf, Buffer.prototype);
  return buf;
}

export function Buffer(arg, encodingOrOffset, length) {
  if (typeof arg === "number") {
    if (typeof encodingOrOffset === "string") {
      throw new codes.ERR_INVALID_ARG_TYPE(
        "string",
        "string",
        arg,
      );
    }
    return _allocUnsafe(arg);
  }
  return _from(arg, encodingOrOffset, length);
}

Buffer.poolSize = 8192;

function _from(value, encodingOrOffset, length) {
  if (typeof value === "string") {
    return fromString(value, encodingOrOffset);
  }

  if (typeof value === "object" && value !== null) {
    if (isAnyArrayBuffer(value)) {
      return fromArrayBuffer(value, encodingOrOffset, length);
    }

    const valueOf = value.valueOf && value.valueOf();
    if (
      valueOf != null &&
      valueOf !== value &&
      (typeof valueOf === "string" || typeof valueOf === "object")
    ) {
      return _from(valueOf, encodingOrOffset, length);
    }

    const b = fromObject(value);
    if (b) {
      return b;
    }

    if (typeof value[Symbol.toPrimitive] === "function") {
      const primitive = value[Symbol.toPrimitive]("string");
      if (typeof primitive === "string") {
        return fromString(primitive, encodingOrOffset);
      }
    }
  }

  throw new codes.ERR_INVALID_ARG_TYPE(
    "first argument",
    ["string", "Buffer", "ArrayBuffer", "Array", "Array-like Object"],
    value,
  );
}

Buffer.from = function from(value, encodingOrOffset, length) {
  return _from(value, encodingOrOffset, length);
};

Object.setPrototypeOf(Buffer.prototype, Uint8Array.prototype);

Object.setPrototypeOf(Buffer, Uint8Array);

function assertSize(size) {
  validateNumber(size, "size");
  if (!(size >= 0 && size <= kMaxLength)) {
    throw new codes.ERR_INVALID_ARG_VALUE.RangeError("size", size);
  }
}

function _alloc(size, fill, encoding) {
  assertSize(size);

  const buffer = createBuffer(size);
  if (fill !== undefined) {
    if (encoding !== undefined && typeof encoding !== "string") {
      throw new codes.ERR_INVALID_ARG_TYPE(
        "encoding",
        "string",
        encoding,
      );
    }
    return buffer.fill(fill, encoding);
  }
  return buffer;
}

Buffer.alloc = function alloc(size, fill, encoding) {
  return _alloc(size, fill, encoding);
};

function _allocUnsafe(size) {
  assertSize(size);
  return createBuffer(size < 0 ? 0 : checked(size) | 0);
}

Buffer.allocUnsafe = function allocUnsafe(size) {
  return _allocUnsafe(size);
};

Buffer.allocUnsafeSlow = function allocUnsafeSlow(size) {
  return _allocUnsafe(size);
};

function fromString(string, encoding) {
  if (typeof encoding !== "string" || encoding === "") {
    encoding = "utf8";
  }
  if (!Buffer.isEncoding(encoding)) {
    throw new codes.ERR_UNKNOWN_ENCODING(encoding);
  }
  const length = byteLength(string, encoding) | 0;
  let buf = createBuffer(length);
  const actual = buf.write(string, encoding);
  if (actual !== length) {
    buf = buf.slice(0, actual);
  }
  return buf;
}

function fromArrayLike(array) {
  const length = array.length < 0 ? 0 : checked(array.length) | 0;
  const buf = createBuffer(length);
  for (let i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255;
  }
  return buf;
}

function fromObject(obj) {
  if (obj.length !== undefined || isAnyArrayBuffer(obj.buffer)) {
    if (typeof obj.length !== "number") {
      return createBuffer(0);
    }
    return fromArrayLike(obj);
  }

  if (obj.type === "Buffer" && Array.isArray(obj.data)) {
    return fromArrayLike(obj.data);
  }
}

function checked(length) {
  if (length >= kMaxLength) {
    throw new RangeError(
      "Attempt to allocate Buffer larger than maximum size: 0x" +
        kMaxLength.toString(16) + " bytes",
    );
  }
  return length | 0;
}

export function SlowBuffer(length) {
  assertSize(length);
  return Buffer.alloc(+length);
}

Object.setPrototypeOf(SlowBuffer.prototype, Uint8Array.prototype);

Object.setPrototypeOf(SlowBuffer, Uint8Array);

Buffer.isBuffer = function isBuffer(b) {
  return b != null && b._isBuffer === true && b !== Buffer.prototype;
};

Buffer.compare = function compare(a, b) {
  if (isInstance(a, Uint8Array)) {
    a = Buffer.from(a, a.offset, a.byteLength);
  }
  if (isInstance(b, Uint8Array)) {
    b = Buffer.from(b, b.offset, b.byteLength);
  }
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError(
      'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array',
    );
  }
  if (a === b) {
    return 0;
  }
  let x = a.length;
  let y = b.length;
  for (let i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i];
      y = b[i];
      break;
    }
  }
  if (x < y) {
    return -1;
  }
  if (y < x) {
    return 1;
  }
  return 0;
};

Buffer.isEncoding = function isEncoding(encoding) {
  return typeof encoding === "string" && encoding.length !== 0 &&
    normalizeEncoding(encoding) !== undefined;
};

Buffer.concat = function concat(list, length) {
  if (!Array.isArray(list)) {
    throw new codes.ERR_INVALID_ARG_TYPE("list", "Array", list);
  }

  if (list.length === 0) {
    return Buffer.alloc(0);
  }

  if (length === undefined) {
    length = 0;
    for (let i = 0; i < list.length; i++) {
      if (list[i].length) {
        length += list[i].length;
      }
    }
  } else {
    validateOffset(length, "length");
  }

  const buffer = Buffer.allocUnsafe(length);
  let pos = 0;
  for (let i = 0; i < list.length; i++) {
    const buf = list[i];
    if (!isUint8Array(buf)) {
      // TODO(BridgeAR): This should not be of type ERR_INVALID_ARG_TYPE.
      // Instead, find the proper error code for this.
      throw new codes.ERR_INVALID_ARG_TYPE(
        `list[${i}]`,
        ["Buffer", "Uint8Array"],
        list[i],
      );
    }
    pos += _copyActual(buf, buffer, pos, 0, buf.length);
  }

  // Note: `length` is always equal to `buffer.length` at this point
  if (pos < length) {
    // Zero-fill the remaining bytes if the specified `length` was more than
    // the actual total length, i.e. if we have some remaining allocated bytes
    // there were not initialized.
    buffer.fill(0, pos, length);
  }

  return buffer;
};

function byteLength(string, encoding) {
  if (typeof string !== "string") {
    if (isArrayBufferView(string) || isAnyArrayBuffer(string)) {
      return string.byteLength;
    }

    throw new codes.ERR_INVALID_ARG_TYPE(
      "string",
      ["string", "Buffer", "ArrayBuffer"],
      string,
    );
  }

  const len = string.length;
  const mustMatch = (arguments.length > 2 && arguments[2] === true);
  if (!mustMatch && len === 0) {
    return 0;
  }

  if (!encoding) {
    return (mustMatch ? -1 : byteLengthUtf8(string));
  }

  const ops = getEncodingOps(encoding);
  if (ops === undefined) {
    return (mustMatch ? -1 : byteLengthUtf8(string));
  }
  return ops.byteLength(string);
}

Buffer.byteLength = byteLength;

Buffer.prototype._isBuffer = true;

function swap(b, n, m) {
  const i = b[n];
  b[n] = b[m];
  b[m] = i;
}

Buffer.prototype.swap16 = function swap16() {
  const len = this.length;
  if (len % 2 !== 0) {
    throw new RangeError("Buffer size must be a multiple of 16-bits");
  }
  for (let i = 0; i < len; i += 2) {
    swap(this, i, i + 1);
  }
  return this;
};

Buffer.prototype.swap32 = function swap32() {
  const len = this.length;
  if (len % 4 !== 0) {
    throw new RangeError("Buffer size must be a multiple of 32-bits");
  }
  for (let i = 0; i < len; i += 4) {
    swap(this, i, i + 3);
    swap(this, i + 1, i + 2);
  }
  return this;
};

Buffer.prototype.swap64 = function swap64() {
  const len = this.length;
  if (len % 8 !== 0) {
    throw new RangeError("Buffer size must be a multiple of 64-bits");
  }
  for (let i = 0; i < len; i += 8) {
    swap(this, i, i + 7);
    swap(this, i + 1, i + 6);
    swap(this, i + 2, i + 5);
    swap(this, i + 3, i + 4);
  }
  return this;
};

Buffer.prototype.toString = function toString(encoding, start, end) {
  if (arguments.length === 0) {
    return this.utf8Slice(0, this.length);
  }

  const len = this.length;

  if (start <= 0) {
    start = 0;
  } else if (start >= len) {
    return "";
  } else {
    start |= 0;
  }

  if (end === undefined || end > len) {
    end = len;
  } else {
    end |= 0;
  }

  if (end <= start) {
    return "";
  }

  if (encoding === undefined) {
    return this.utf8Slice(start, end);
  }

  const ops = getEncodingOps(encoding);
  if (ops === undefined) {
    throw new codes.ERR_UNKNOWN_ENCODING(encoding);
  }

  return ops.slice(this, start, end);
};

Buffer.prototype.toLocaleString = Buffer.prototype.toString;

Buffer.prototype.equals = function equals(b) {
  if (!isUint8Array(b)) {
    throw new codes.ERR_INVALID_ARG_TYPE(
      "otherBuffer",
      ["Buffer", "Uint8Array"],
      b,
    );
  }
  if (this === b) {
    return true;
  }
  return Buffer.compare(this, b) === 0;
};

Buffer.prototype.inspect = function inspect() {
  let str = "";
  const max = INSPECT_MAX_BYTES;
  str = this.toString("hex", 0, max).replace(/(.{2})/g, "$1 ").trim();
  if (this.length > max) {
    str += " ... ";
  }
  return "<Buffer " + str + ">";
};

if (customInspectSymbol) {
  Buffer.prototype[customInspectSymbol] = Buffer.prototype.inspect;
}

Buffer.prototype.compare = function compare(
  target,
  start,
  end,
  thisStart,
  thisEnd,
) {
  if (isInstance(target, Uint8Array)) {
    target = Buffer.from(target, target.offset, target.byteLength);
  }
  if (!Buffer.isBuffer(target)) {
    throw new codes.ERR_INVALID_ARG_TYPE(
      "target",
      ["Buffer", "Uint8Array"],
      target,
    );
  }

  if (start === undefined) {
    start = 0;
  } else {
    validateOffset(start, "targetStart", 0, kMaxLength);
  }

  if (end === undefined) {
    end = target.length;
  } else {
    validateOffset(end, "targetEnd", 0, target.length);
  }

  if (thisStart === undefined) {
    thisStart = 0;
  } else {
    validateOffset(start, "sourceStart", 0, kMaxLength);
  }

  if (thisEnd === undefined) {
    thisEnd = this.length;
  } else {
    validateOffset(end, "sourceEnd", 0, this.length);
  }

  if (
    start < 0 || end > target.length || thisStart < 0 ||
    thisEnd > this.length
  ) {
    throw new codes.ERR_OUT_OF_RANGE("out of range index", "range");
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0;
  }
  if (thisStart >= thisEnd) {
    return -1;
  }
  if (start >= end) {
    return 1;
  }
  start >>>= 0;
  end >>>= 0;
  thisStart >>>= 0;
  thisEnd >>>= 0;
  if (this === target) {
    return 0;
  }
  let x = thisEnd - thisStart;
  let y = end - start;
  const len = Math.min(x, y);
  const thisCopy = this.slice(thisStart, thisEnd);
  const targetCopy = target.slice(start, end);
  for (let i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i];
      y = targetCopy[i];
      break;
    }
  }
  if (x < y) {
    return -1;
  }
  if (y < x) {
    return 1;
  }
  return 0;
};

function bidirectionalIndexOf(buffer, val, byteOffset, encoding, dir) {
  validateBuffer(buffer);

  if (typeof byteOffset === "string") {
    encoding = byteOffset;
    byteOffset = undefined;
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff;
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000;
  }
  byteOffset = +byteOffset;
  if (Number.isNaN(byteOffset)) {
    byteOffset = dir ? 0 : (buffer.length || buffer.byteLength);
  }
  dir = !!dir;

  if (typeof val === "number") {
    return indexOfNumber(buffer, val >>> 0, byteOffset, dir);
  }

  let ops;
  if (encoding === undefined) {
    ops = encodingOps.utf8;
  } else {
    ops = getEncodingOps(encoding);
  }

  if (typeof val === "string") {
    if (ops === undefined) {
      throw new codes.ERR_UNKNOWN_ENCODING(encoding);
    }
    return ops.indexOf(buffer, val, byteOffset, dir);
  }

  if (isUint8Array(val)) {
    const encodingVal =
      (ops === undefined ? encodingsMap.utf8 : ops.encodingVal);
    return indexOfBuffer(buffer, val, byteOffset, encodingVal, dir);
  }

  throw new codes.ERR_INVALID_ARG_TYPE(
    "value",
    ["number", "string", "Buffer", "Uint8Array"],
    val,
  );
}

Buffer.prototype.includes = function includes(val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1;
};

Buffer.prototype.indexOf = function indexOf(val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true);
};

Buffer.prototype.lastIndexOf = function lastIndexOf(
  val,
  byteOffset,
  encoding,
) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false);
};

Buffer.prototype.asciiSlice = function asciiSlice(offset, length) {
  if (offset === 0 && length === this.length) {
    return bytesToAscii(this);
  } else {
    return bytesToAscii(this.slice(offset, length));
  }
};

Buffer.prototype.asciiWrite = function asciiWrite(string, offset, length) {
  return blitBuffer(asciiToBytes(string), this, offset, length);
};

Buffer.prototype.base64Slice = function base64Slice(
  offset,
  length,
) {
  if (offset === 0 && length === this.length) {
    return base64.encode(this);
  } else {
    return base64.encode(this.slice(offset, length));
  }
};

Buffer.prototype.base64Write = function base64Write(
  string,
  offset,
  length,
) {
  return blitBuffer(base64ToBytes(string), this, offset, length);
};

Buffer.prototype.base64urlSlice = function base64urlSlice(
  offset,
  length,
) {
  if (offset === 0 && length === this.length) {
    return base64url.encode(this);
  } else {
    return base64url.encode(this.slice(offset, length));
  }
};

Buffer.prototype.base64urlWrite = function base64urlWrite(
  string,
  offset,
  length,
) {
  return blitBuffer(base64UrlToBytes(string), this, offset, length);
};

Buffer.prototype.hexWrite = function hexWrite(string, offset, length) {
  return blitBuffer(
    hexToBytes(string, this.length - offset),
    this,
    offset,
    length,
  );
};

Buffer.prototype.hexSlice = function hexSlice(string, offset, length) {
  return _hexSlice(this, string, offset, length);
};

Buffer.prototype.latin1Slice = function latin1Slice(
  string,
  offset,
  length,
) {
  return _latin1Slice(this, string, offset, length);
};

Buffer.prototype.latin1Write = function latin1Write(
  string,
  offset,
  length,
) {
  return blitBuffer(asciiToBytes(string), this, offset, length);
};

Buffer.prototype.ucs2Slice = function ucs2Slice(offset, length) {
  if (offset === 0 && length === this.length) {
    return bytesToUtf16le(this);
  } else {
    return bytesToUtf16le(this.slice(offset, length));
  }
};

Buffer.prototype.ucs2Write = function ucs2Write(string, offset, length) {
  return blitBuffer(
    utf16leToBytes(string, this.length - offset),
    this,
    offset,
    length,
  );
};

Buffer.prototype.utf8Slice = function utf8Slice(string, offset, length) {
  return _utf8Slice(this, string, offset, length);
};

Buffer.prototype.utf8Write = function utf8Write(string, offset, length) {
  return blitBuffer(
    utf8ToBytes(string, this.length - offset),
    this,
    offset,
    length,
  );
};

Buffer.prototype.write = function write(string, offset, length, encoding) {
  // Buffer#write(string);
  if (offset === undefined) {
    return this.utf8Write(string, 0, this.length);
  }
  // Buffer#write(string, encoding)
  if (length === undefined && typeof offset === "string") {
    encoding = offset;
    length = this.length;
    offset = 0;

    // Buffer#write(string, offset[, length][, encoding])
  } else {
    validateOffset(offset, "offset", 0, this.length);

    const remaining = this.length - offset;

    if (length === undefined) {
      length = remaining;
    } else if (typeof length === "string") {
      encoding = length;
      length = remaining;
    } else {
      validateOffset(length, "length", 0, this.length);
      if (length > remaining) {
        length = remaining;
      }
    }
  }

  if (!encoding) {
    return this.utf8Write(string, offset, length);
  }

  const ops = getEncodingOps(encoding);
  if (ops === undefined) {
    throw new codes.ERR_UNKNOWN_ENCODING(encoding);
  }
  return ops.write(this, string, offset, length);
};

Buffer.prototype.toJSON = function toJSON() {
  return {
    type: "Buffer",
    data: Array.prototype.slice.call(this._arr || this, 0),
  };
};
function fromArrayBuffer(obj, byteOffset, length) {
  // Convert byteOffset to integer
  if (byteOffset === undefined) {
    byteOffset = 0;
  } else {
    byteOffset = +byteOffset;
    if (Number.isNaN(byteOffset)) {
      byteOffset = 0;
    }
  }

  const maxLength = obj.byteLength - byteOffset;

  if (maxLength < 0) {
    throw new codes.ERR_BUFFER_OUT_OF_BOUNDS("offset");
  }

  if (length === undefined) {
    length = maxLength;
  } else {
    // Convert length to non-negative integer.
    length = +length;
    if (length > 0) {
      if (length > maxLength) {
        throw new codes.ERR_BUFFER_OUT_OF_BOUNDS("length");
      }
    } else {
      length = 0;
    }
  }

  const buffer = new Uint8Array(obj, byteOffset, length);
  Object.setPrototypeOf(buffer, Buffer.prototype);
  return buffer;
}

function _base64Slice(buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.encode(buf);
  } else {
    return base64.encode(buf.slice(start, end));
  }
}

function _utf8Slice(buf, start, end) {
  end = Math.min(buf.length, end);
  const res = [];
  let i = start;
  while (i < end) {
    const firstByte = buf[i];
    let codePoint = null;
    let bytesPerSequence = firstByte > 239
      ? 4
      : firstByte > 223
      ? 3
      : firstByte > 191
      ? 2
      : 1;
    if (i + bytesPerSequence <= end) {
      let secondByte, thirdByte, fourthByte, tempCodePoint;
      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 128) {
            codePoint = firstByte;
          }
          break;
        case 2:
          secondByte = buf[i + 1];
          if ((secondByte & 192) === 128) {
            tempCodePoint = (firstByte & 31) << 6 | secondByte & 63;
            if (tempCodePoint > 127) {
              codePoint = tempCodePoint;
            }
          }
          break;
        case 3:
          secondByte = buf[i + 1];
          thirdByte = buf[i + 2];
          if ((secondByte & 192) === 128 && (thirdByte & 192) === 128) {
            tempCodePoint = (firstByte & 15) << 12 |
              (secondByte & 63) << 6 | thirdByte & 63;
            if (
              tempCodePoint > 2047 &&
              (tempCodePoint < 55296 || tempCodePoint > 57343)
            ) {
              codePoint = tempCodePoint;
            }
          }
          break;
        case 4:
          secondByte = buf[i + 1];
          thirdByte = buf[i + 2];
          fourthByte = buf[i + 3];
          if (
            (secondByte & 192) === 128 && (thirdByte & 192) === 128 &&
            (fourthByte & 192) === 128
          ) {
            tempCodePoint = (firstByte & 15) << 18 |
              (secondByte & 63) << 12 | (thirdByte & 63) << 6 |
              fourthByte & 63;
            if (tempCodePoint > 65535 && tempCodePoint < 1114112) {
              codePoint = tempCodePoint;
            }
          }
      }
    }
    if (codePoint === null) {
      codePoint = 65533;
      bytesPerSequence = 1;
    } else if (codePoint > 65535) {
      codePoint -= 65536;
      res.push(codePoint >>> 10 & 1023 | 55296);
      codePoint = 56320 | codePoint & 1023;
    }
    res.push(codePoint);
    i += bytesPerSequence;
  }
  return decodeCodePointsArray(res);
}

const MAX_ARGUMENTS_LENGTH = 4096;

function decodeCodePointsArray(codePoints) {
  const len = codePoints.length;
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints);
  }
  let res = "";
  let i = 0;
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH),
    );
  }
  return res;
}

function _latin1Slice(buf, start, end) {
  let ret = "";
  end = Math.min(buf.length, end);
  for (let i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i]);
  }
  return ret;
}

function _hexSlice(buf, start, end) {
  const len = buf.length;
  if (!start || start < 0) {
    start = 0;
  }
  if (!end || end < 0 || end > len) {
    end = len;
  }
  let out = "";
  for (let i = start; i < end; ++i) {
    out += hexSliceLookupTable[buf[i]];
  }
  return out;
}

Buffer.prototype.slice = function slice(start, end) {
  const len = this.length;
  start = ~~start;
  end = end === void 0 ? len : ~~end;
  if (start < 0) {
    start += len;
    if (start < 0) {
      start = 0;
    }
  } else if (start > len) {
    start = len;
  }
  if (end < 0) {
    end += len;
    if (end < 0) {
      end = 0;
    }
  } else if (end > len) {
    end = len;
  }
  if (end < start) {
    end = start;
  }
  const newBuf = this.subarray(start, end);
  Object.setPrototypeOf(newBuf, Buffer.prototype);
  return newBuf;
};

Buffer.prototype.readUintLE = Buffer.prototype.readUIntLE = function readUIntLE(
  offset,
  byteLength,
) {
  if (offset === undefined) {
    throw new codes.ERR_INVALID_ARG_TYPE("offset", "number", offset);
  }
  if (byteLength === 6) {
    return readUInt48LE(this, offset);
  }
  if (byteLength === 5) {
    return readUInt40LE(this, offset);
  }
  if (byteLength === 3) {
    return readUInt24LE(this, offset);
  }
  if (byteLength === 4) {
    return this.readUInt32LE(offset);
  }
  if (byteLength === 2) {
    return this.readUInt16LE(offset);
  }
  if (byteLength === 1) {
    return this.readUInt8(offset);
  }

  boundsError(byteLength, 6, "byteLength");
};

Buffer.prototype.readUintBE = Buffer.prototype.readUIntBE = function readUIntBE(
  offset,
  byteLength,
) {
  if (offset === undefined) {
    throw new codes.ERR_INVALID_ARG_TYPE("offset", "number", offset);
  }
  if (byteLength === 6) {
    return readUInt48BE(this, offset);
  }
  if (byteLength === 5) {
    return readUInt40BE(this, offset);
  }
  if (byteLength === 3) {
    return readUInt24BE(this, offset);
  }
  if (byteLength === 4) {
    return this.readUInt32BE(offset);
  }
  if (byteLength === 2) {
    return this.readUInt16BE(offset);
  }
  if (byteLength === 1) {
    return this.readUInt8(offset);
  }

  boundsError(byteLength, 6, "byteLength");
};

Buffer.prototype.readUint8 = Buffer.prototype.readUInt8 = function readUInt8(
  offset = 0,
) {
  validateNumber(offset, "offset");
  const val = this[offset];
  if (val === undefined) {
    boundsError(offset, this.length - 1);
  }

  return val;
};

Buffer.prototype.readUint16BE = Buffer.prototype.readUInt16BE = readUInt16BE;

Buffer.prototype.readUint16LE =
  Buffer.prototype.readUInt16LE =
    function readUInt16LE(offset = 0) {
      validateNumber(offset, "offset");
      const first = this[offset];
      const last = this[offset + 1];
      if (first === undefined || last === undefined) {
        boundsError(offset, this.length - 2);
      }

      return first + last * 2 ** 8;
    };

Buffer.prototype.readUint32LE =
  Buffer.prototype.readUInt32LE =
    function readUInt32LE(offset = 0) {
      validateNumber(offset, "offset");
      const first = this[offset];
      const last = this[offset + 3];
      if (first === undefined || last === undefined) {
        boundsError(offset, this.length - 4);
      }

      return first +
        this[++offset] * 2 ** 8 +
        this[++offset] * 2 ** 16 +
        last * 2 ** 24;
    };

Buffer.prototype.readUint32BE = Buffer.prototype.readUInt32BE = readUInt32BE;

Buffer.prototype.readBigUint64LE =
  Buffer.prototype.readBigUInt64LE =
    defineBigIntMethod(
      function readBigUInt64LE(offset) {
        offset = offset >>> 0;
        validateNumber(offset, "offset");
        const first = this[offset];
        const last = this[offset + 7];
        if (first === void 0 || last === void 0) {
          boundsError(offset, this.length - 8);
        }
        const lo = first + this[++offset] * 2 ** 8 +
          this[++offset] * 2 ** 16 +
          this[++offset] * 2 ** 24;
        const hi = this[++offset] + this[++offset] * 2 ** 8 +
          this[++offset] * 2 ** 16 + last * 2 ** 24;
        return BigInt(lo) + (BigInt(hi) << BigInt(32));
      },
    );

Buffer.prototype.readBigUint64BE =
  Buffer.prototype.readBigUInt64BE =
    defineBigIntMethod(
      function readBigUInt64BE(offset) {
        offset = offset >>> 0;
        validateNumber(offset, "offset");
        const first = this[offset];
        const last = this[offset + 7];
        if (first === void 0 || last === void 0) {
          boundsError(offset, this.length - 8);
        }
        const hi = first * 2 ** 24 + this[++offset] * 2 ** 16 +
          this[++offset] * 2 ** 8 + this[++offset];
        const lo = this[++offset] * 2 ** 24 + this[++offset] * 2 ** 16 +
          this[++offset] * 2 ** 8 + last;
        return (BigInt(hi) << BigInt(32)) + BigInt(lo);
      },
    );

Buffer.prototype.readIntLE = function readIntLE(
  offset,
  byteLength,
) {
  if (offset === undefined) {
    throw new codes.ERR_INVALID_ARG_TYPE("offset", "number", offset);
  }
  if (byteLength === 6) {
    return readInt48LE(this, offset);
  }
  if (byteLength === 5) {
    return readInt40LE(this, offset);
  }
  if (byteLength === 3) {
    return readInt24LE(this, offset);
  }
  if (byteLength === 4) {
    return this.readInt32LE(offset);
  }
  if (byteLength === 2) {
    return this.readInt16LE(offset);
  }
  if (byteLength === 1) {
    return this.readInt8(offset);
  }

  boundsError(byteLength, 6, "byteLength");
};

Buffer.prototype.readIntBE = function readIntBE(offset, byteLength) {
  if (offset === undefined) {
    throw new codes.ERR_INVALID_ARG_TYPE("offset", "number", offset);
  }
  if (byteLength === 6) {
    return readInt48BE(this, offset);
  }
  if (byteLength === 5) {
    return readInt40BE(this, offset);
  }
  if (byteLength === 3) {
    return readInt24BE(this, offset);
  }
  if (byteLength === 4) {
    return this.readInt32BE(offset);
  }
  if (byteLength === 2) {
    return this.readInt16BE(offset);
  }
  if (byteLength === 1) {
    return this.readInt8(offset);
  }

  boundsError(byteLength, 6, "byteLength");
};

Buffer.prototype.readInt8 = function readInt8(offset = 0) {
  validateNumber(offset, "offset");
  const val = this[offset];
  if (val === undefined) {
    boundsError(offset, this.length - 1);
  }

  return val | (val & 2 ** 7) * 0x1fffffe;
};

Buffer.prototype.readInt16LE = function readInt16LE(offset = 0) {
  validateNumber(offset, "offset");
  const first = this[offset];
  const last = this[offset + 1];
  if (first === undefined || last === undefined) {
    boundsError(offset, this.length - 2);
  }

  const val = first + last * 2 ** 8;
  return val | (val & 2 ** 15) * 0x1fffe;
};

Buffer.prototype.readInt16BE = function readInt16BE(offset = 0) {
  validateNumber(offset, "offset");
  const first = this[offset];
  const last = this[offset + 1];
  if (first === undefined || last === undefined) {
    boundsError(offset, this.length - 2);
  }

  const val = first * 2 ** 8 + last;
  return val | (val & 2 ** 15) * 0x1fffe;
};

Buffer.prototype.readInt32LE = function readInt32LE(offset = 0) {
  validateNumber(offset, "offset");
  const first = this[offset];
  const last = this[offset + 3];
  if (first === undefined || last === undefined) {
    boundsError(offset, this.length - 4);
  }

  return first +
    this[++offset] * 2 ** 8 +
    this[++offset] * 2 ** 16 +
    (last << 24); // Overflow
};

Buffer.prototype.readInt32BE = function readInt32BE(offset = 0) {
  validateNumber(offset, "offset");
  const first = this[offset];
  const last = this[offset + 3];
  if (first === undefined || last === undefined) {
    boundsError(offset, this.length - 4);
  }

  return (first << 24) + // Overflow
    this[++offset] * 2 ** 16 +
    this[++offset] * 2 ** 8 +
    last;
};

Buffer.prototype.readBigInt64LE = defineBigIntMethod(
  function readBigInt64LE(offset) {
    offset = offset >>> 0;
    validateNumber(offset, "offset");
    const first = this[offset];
    const last = this[offset + 7];
    if (first === void 0 || last === void 0) {
      boundsError(offset, this.length - 8);
    }
    const val = this[offset + 4] + this[offset + 5] * 2 ** 8 +
      this[offset + 6] * 2 ** 16 + (last << 24);
    return (BigInt(val) << BigInt(32)) +
      BigInt(
        first + this[++offset] * 2 ** 8 + this[++offset] * 2 ** 16 +
          this[++offset] * 2 ** 24,
      );
  },
);

Buffer.prototype.readBigInt64BE = defineBigIntMethod(
  function readBigInt64BE(offset) {
    offset = offset >>> 0;
    validateNumber(offset, "offset");
    const first = this[offset];
    const last = this[offset + 7];
    if (first === void 0 || last === void 0) {
      boundsError(offset, this.length - 8);
    }
    const val = (first << 24) + this[++offset] * 2 ** 16 +
      this[++offset] * 2 ** 8 + this[++offset];
    return (BigInt(val) << BigInt(32)) +
      BigInt(
        this[++offset] * 2 ** 24 + this[++offset] * 2 ** 16 +
          this[++offset] * 2 ** 8 + last,
      );
  },
);

Buffer.prototype.readFloatLE = function readFloatLE(offset) {
  return bigEndian
    ? readFloatBackwards(this, offset)
    : readFloatForwards(this, offset);
};

Buffer.prototype.readFloatBE = function readFloatBE(offset) {
  return bigEndian
    ? readFloatForwards(this, offset)
    : readFloatBackwards(this, offset);
};

Buffer.prototype.readDoubleLE = function readDoubleLE(offset) {
  return bigEndian
    ? readDoubleBackwards(this, offset)
    : readDoubleForwards(this, offset);
};

Buffer.prototype.readDoubleBE = function readDoubleBE(offset) {
  return bigEndian
    ? readDoubleForwards(this, offset)
    : readDoubleBackwards(this, offset);
};

Buffer.prototype.writeUintLE =
  Buffer.prototype.writeUIntLE =
    function writeUIntLE(value, offset, byteLength) {
      if (byteLength === 6) {
        return writeU_Int48LE(this, value, offset, 0, 0xffffffffffff);
      }
      if (byteLength === 5) {
        return writeU_Int40LE(this, value, offset, 0, 0xffffffffff);
      }
      if (byteLength === 3) {
        return writeU_Int24LE(this, value, offset, 0, 0xffffff);
      }
      if (byteLength === 4) {
        return writeU_Int32LE(this, value, offset, 0, 0xffffffff);
      }
      if (byteLength === 2) {
        return writeU_Int16LE(this, value, offset, 0, 0xffff);
      }
      if (byteLength === 1) {
        return writeU_Int8(this, value, offset, 0, 0xff);
      }

      boundsError(byteLength, 6, "byteLength");
    };

Buffer.prototype.writeUintBE =
  Buffer.prototype.writeUIntBE =
    function writeUIntBE(value, offset, byteLength) {
      if (byteLength === 6) {
        return writeU_Int48BE(this, value, offset, 0, 0xffffffffffff);
      }
      if (byteLength === 5) {
        return writeU_Int40BE(this, value, offset, 0, 0xffffffffff);
      }
      if (byteLength === 3) {
        return writeU_Int24BE(this, value, offset, 0, 0xffffff);
      }
      if (byteLength === 4) {
        return writeU_Int32BE(this, value, offset, 0, 0xffffffff);
      }
      if (byteLength === 2) {
        return writeU_Int16BE(this, value, offset, 0, 0xffff);
      }
      if (byteLength === 1) {
        return writeU_Int8(this, value, offset, 0, 0xff);
      }

      boundsError(byteLength, 6, "byteLength");
    };

Buffer.prototype.writeUint8 = Buffer.prototype.writeUInt8 = function writeUInt8(
  value,
  offset = 0,
) {
  return writeU_Int8(this, value, offset, 0, 0xff);
};

Buffer.prototype.writeUint16LE =
  Buffer.prototype.writeUInt16LE =
    function writeUInt16LE(value, offset = 0) {
      return writeU_Int16LE(this, value, offset, 0, 0xffff);
    };

Buffer.prototype.writeUint16BE =
  Buffer.prototype.writeUInt16BE =
    function writeUInt16BE(value, offset = 0) {
      return writeU_Int16BE(this, value, offset, 0, 0xffff);
    };

Buffer.prototype.writeUint32LE =
  Buffer.prototype.writeUInt32LE =
    function writeUInt32LE(value, offset = 0) {
      return _writeUInt32LE(this, value, offset, 0, 0xffffffff);
    };

Buffer.prototype.writeUint32BE =
  Buffer.prototype.writeUInt32BE =
    function writeUInt32BE(value, offset = 0) {
      return _writeUInt32BE(this, value, offset, 0, 0xffffffff);
    };

function wrtBigUInt64LE(buf, value, offset, min, max) {
  checkIntBI(value, min, max, buf, offset, 7);
  let lo = Number(value & BigInt(4294967295));
  buf[offset++] = lo;
  lo = lo >> 8;
  buf[offset++] = lo;
  lo = lo >> 8;
  buf[offset++] = lo;
  lo = lo >> 8;
  buf[offset++] = lo;
  let hi = Number(value >> BigInt(32) & BigInt(4294967295));
  buf[offset++] = hi;
  hi = hi >> 8;
  buf[offset++] = hi;
  hi = hi >> 8;
  buf[offset++] = hi;
  hi = hi >> 8;
  buf[offset++] = hi;
  return offset;
}

function wrtBigUInt64BE(buf, value, offset, min, max) {
  checkIntBI(value, min, max, buf, offset, 7);
  let lo = Number(value & BigInt(4294967295));
  buf[offset + 7] = lo;
  lo = lo >> 8;
  buf[offset + 6] = lo;
  lo = lo >> 8;
  buf[offset + 5] = lo;
  lo = lo >> 8;
  buf[offset + 4] = lo;
  let hi = Number(value >> BigInt(32) & BigInt(4294967295));
  buf[offset + 3] = hi;
  hi = hi >> 8;
  buf[offset + 2] = hi;
  hi = hi >> 8;
  buf[offset + 1] = hi;
  hi = hi >> 8;
  buf[offset] = hi;
  return offset + 8;
}

Buffer.prototype.writeBigUint64LE =
  Buffer.prototype.writeBigUInt64LE =
    defineBigIntMethod(
      function writeBigUInt64LE(value, offset = 0) {
        return wrtBigUInt64LE(
          this,
          value,
          offset,
          BigInt(0),
          BigInt("0xffffffffffffffff"),
        );
      },
    );

Buffer.prototype.writeBigUint64BE =
  Buffer.prototype.writeBigUInt64BE =
    defineBigIntMethod(
      function writeBigUInt64BE(value, offset = 0) {
        return wrtBigUInt64BE(
          this,
          value,
          offset,
          BigInt(0),
          BigInt("0xffffffffffffffff"),
        );
      },
    );

Buffer.prototype.writeIntLE = function writeIntLE(
  value,
  offset,
  byteLength,
) {
  if (byteLength === 6) {
    return writeU_Int48LE(
      this,
      value,
      offset,
      -0x800000000000,
      0x7fffffffffff,
    );
  }
  if (byteLength === 5) {
    return writeU_Int40LE(this, value, offset, -0x8000000000, 0x7fffffffff);
  }
  if (byteLength === 3) {
    return writeU_Int24LE(this, value, offset, -0x800000, 0x7fffff);
  }
  if (byteLength === 4) {
    return writeU_Int32LE(this, value, offset, -0x80000000, 0x7fffffff);
  }
  if (byteLength === 2) {
    return writeU_Int16LE(this, value, offset, -0x8000, 0x7fff);
  }
  if (byteLength === 1) {
    return writeU_Int8(this, value, offset, -0x80, 0x7f);
  }

  boundsError(byteLength, 6, "byteLength");
};

Buffer.prototype.writeIntBE = function writeIntBE(
  value,
  offset,
  byteLength,
) {
  if (byteLength === 6) {
    return writeU_Int48BE(
      this,
      value,
      offset,
      -0x800000000000,
      0x7fffffffffff,
    );
  }
  if (byteLength === 5) {
    return writeU_Int40BE(this, value, offset, -0x8000000000, 0x7fffffffff);
  }
  if (byteLength === 3) {
    return writeU_Int24BE(this, value, offset, -0x800000, 0x7fffff);
  }
  if (byteLength === 4) {
    return writeU_Int32BE(this, value, offset, -0x80000000, 0x7fffffff);
  }
  if (byteLength === 2) {
    return writeU_Int16BE(this, value, offset, -0x8000, 0x7fff);
  }
  if (byteLength === 1) {
    return writeU_Int8(this, value, offset, -0x80, 0x7f);
  }

  boundsError(byteLength, 6, "byteLength");
};

Buffer.prototype.writeInt8 = function writeInt8(value, offset = 0) {
  return writeU_Int8(this, value, offset, -0x80, 0x7f);
};

Buffer.prototype.writeInt16LE = function writeInt16LE(value, offset = 0) {
  return writeU_Int16LE(this, value, offset, -0x8000, 0x7fff);
};

Buffer.prototype.writeInt16BE = function writeInt16BE(
  value,
  offset = 0,
) {
  return writeU_Int16BE(this, value, offset, -0x8000, 0x7fff);
};

Buffer.prototype.writeInt32LE = function writeInt32LE(value, offset = 0) {
  return writeU_Int32LE(this, value, offset, -0x80000000, 0x7fffffff);
};

Buffer.prototype.writeInt32BE = function writeInt32BE(value, offset = 0) {
  return writeU_Int32BE(this, value, offset, -0x80000000, 0x7fffffff);
};

Buffer.prototype.writeBigInt64LE = defineBigIntMethod(
  function writeBigInt64LE(value, offset = 0) {
    return wrtBigUInt64LE(
      this,
      value,
      offset,
      -BigInt("0x8000000000000000"),
      BigInt("0x7fffffffffffffff"),
    );
  },
);

Buffer.prototype.writeBigInt64BE = defineBigIntMethod(
  function writeBigInt64BE(value, offset = 0) {
    return wrtBigUInt64BE(
      this,
      value,
      offset,
      -BigInt("0x8000000000000000"),
      BigInt("0x7fffffffffffffff"),
    );
  },
);

Buffer.prototype.writeFloatLE = function writeFloatLE(
  value,
  offset,
) {
  return bigEndian
    ? writeFloatBackwards(this, value, offset)
    : writeFloatForwards(this, value, offset);
};

Buffer.prototype.writeFloatBE = function writeFloatBE(
  value,
  offset,
) {
  return bigEndian
    ? writeFloatForwards(this, value, offset)
    : writeFloatBackwards(this, value, offset);
};

Buffer.prototype.writeDoubleLE = function writeDoubleLE(
  value,
  offset,
) {
  return bigEndian
    ? writeDoubleBackwards(this, value, offset)
    : writeDoubleForwards(this, value, offset);
};

Buffer.prototype.writeDoubleBE = function writeDoubleBE(
  value,
  offset,
) {
  return bigEndian
    ? writeDoubleForwards(this, value, offset)
    : writeDoubleBackwards(this, value, offset);
};

Buffer.prototype.copy = function copy(
  target,
  targetStart,
  sourceStart,
  sourceEnd,
) {
  if (!isUint8Array(this)) {
    throw new codes.ERR_INVALID_ARG_TYPE(
      "source",
      ["Buffer", "Uint8Array"],
      this,
    );
  }

  if (!isUint8Array(target)) {
    throw new codes.ERR_INVALID_ARG_TYPE(
      "target",
      ["Buffer", "Uint8Array"],
      target,
    );
  }

  if (targetStart === undefined) {
    targetStart = 0;
  } else {
    targetStart = toInteger(targetStart, 0);
    if (targetStart < 0) {
      throw new codes.ERR_OUT_OF_RANGE("targetStart", ">= 0", targetStart);
    }
  }

  if (sourceStart === undefined) {
    sourceStart = 0;
  } else {
    sourceStart = toInteger(sourceStart, 0);
    if (sourceStart < 0) {
      throw new codes.ERR_OUT_OF_RANGE("sourceStart", ">= 0", sourceStart);
    }
    if (sourceStart >= MAX_UINT32) {
      throw new codes.ERR_OUT_OF_RANGE(
        "sourceStart",
        `< ${MAX_UINT32}`,
        sourceStart,
      );
    }
  }

  if (sourceEnd === undefined) {
    sourceEnd = this.length;
  } else {
    sourceEnd = toInteger(sourceEnd, 0);
    if (sourceEnd < 0) {
      throw new codes.ERR_OUT_OF_RANGE("sourceEnd", ">= 0", sourceEnd);
    }
    if (sourceEnd >= MAX_UINT32) {
      throw new codes.ERR_OUT_OF_RANGE(
        "sourceEnd",
        `< ${MAX_UINT32}`,
        sourceEnd,
      );
    }
  }

  if (targetStart >= target.length) {
    return 0;
  }

  if (sourceEnd > 0 && sourceEnd < sourceStart) {
    sourceEnd = sourceStart;
  }
  if (sourceEnd === sourceStart) {
    return 0;
  }
  if (target.length === 0 || this.length === 0) {
    return 0;
  }

  if (sourceEnd > this.length) {
    sourceEnd = this.length;
  }

  if (target.length - targetStart < sourceEnd - sourceStart) {
    sourceEnd = target.length - targetStart + sourceStart;
  }

  const len = sourceEnd - sourceStart;
  if (
    this === target && typeof Uint8Array.prototype.copyWithin === "function"
  ) {
    this.copyWithin(targetStart, sourceStart, sourceEnd);
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(sourceStart, sourceEnd),
      targetStart,
    );
  }
  return len;
};

Buffer.prototype.fill = function fill(val, start, end, encoding) {
  if (typeof val === "string") {
    if (typeof start === "string") {
      encoding = start;
      start = 0;
      end = this.length;
    } else if (typeof end === "string") {
      encoding = end;
      end = this.length;
    }
    if (encoding !== void 0 && typeof encoding !== "string") {
      throw new TypeError("encoding must be a string");
    }
    if (typeof encoding === "string" && !Buffer.isEncoding(encoding)) {
      throw new TypeError("Unknown encoding: " + encoding);
    }
    if (val.length === 1) {
      const code = val.charCodeAt(0);
      if (encoding === "utf8" && code < 128 || encoding === "latin1") {
        val = code;
      }
    }
  } else if (typeof val === "number") {
    val = val & 255;
  } else if (typeof val === "boolean") {
    val = Number(val);
  }
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError("Out of range index");
  }
  if (end <= start) {
    return this;
  }
  start = start >>> 0;
  end = end === void 0 ? this.length : end >>> 0;
  if (!val) {
    val = 0;
  }
  let i;
  if (typeof val === "number") {
    for (i = start; i < end; ++i) {
      this[i] = val;
    }
  } else {
    const bytes = Buffer.isBuffer(val) ? val : Buffer.from(val, encoding);
    const len = bytes.length;
    if (len === 0) {
      throw new codes.ERR_INVALID_ARG_VALUE(
        "value",
        val,
      );
    }
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len];
    }
  }
  return this;
};

function checkBounds(buf, offset, byteLength2) {
  validateNumber(offset, "offset");
  if (buf[offset] === void 0 || buf[offset + byteLength2] === void 0) {
    boundsError(offset, buf.length - (byteLength2 + 1));
  }
}

function checkIntBI(value, min, max, buf, offset, byteLength2) {
  if (value > max || value < min) {
    const n = typeof min === "bigint" ? "n" : "";
    let range;
    if (byteLength2 > 3) {
      if (min === 0 || min === BigInt(0)) {
        range = `>= 0${n} and < 2${n} ** ${(byteLength2 + 1) * 8}${n}`;
      } else {
        range = `>= -(2${n} ** ${(byteLength2 + 1) * 8 - 1}${n}) and < 2 ** ${
          (byteLength2 + 1) * 8 - 1
        }${n}`;
      }
    } else {
      range = `>= ${min}${n} and <= ${max}${n}`;
    }
    throw new codes.ERR_OUT_OF_RANGE("value", range, value);
  }
  checkBounds(buf, offset, byteLength2);
}

function utf8ToBytes(string, units) {
  units = units || Infinity;
  let codePoint;
  const length = string.length;
  let leadSurrogate = null;
  const bytes = [];
  for (let i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i);
    if (codePoint > 55295 && codePoint < 57344) {
      if (!leadSurrogate) {
        if (codePoint > 56319) {
          if ((units -= 3) > -1) {
            bytes.push(239, 191, 189);
          }
          continue;
        } else if (i + 1 === length) {
          if ((units -= 3) > -1) {
            bytes.push(239, 191, 189);
          }
          continue;
        }
        leadSurrogate = codePoint;
        continue;
      }
      if (codePoint < 56320) {
        if ((units -= 3) > -1) {
          bytes.push(239, 191, 189);
        }
        leadSurrogate = codePoint;
        continue;
      }
      codePoint = (leadSurrogate - 55296 << 10 | codePoint - 56320) + 65536;
    } else if (leadSurrogate) {
      if ((units -= 3) > -1) {
        bytes.push(239, 191, 189);
      }
    }
    leadSurrogate = null;
    if (codePoint < 128) {
      if ((units -= 1) < 0) {
        break;
      }
      bytes.push(codePoint);
    } else if (codePoint < 2048) {
      if ((units -= 2) < 0) {
        break;
      }
      bytes.push(codePoint >> 6 | 192, codePoint & 63 | 128);
    } else if (codePoint < 65536) {
      if ((units -= 3) < 0) {
        break;
      }
      bytes.push(
        codePoint >> 12 | 224,
        codePoint >> 6 & 63 | 128,
        codePoint & 63 | 128,
      );
    } else if (codePoint < 1114112) {
      if ((units -= 4) < 0) {
        break;
      }
      bytes.push(
        codePoint >> 18 | 240,
        codePoint >> 12 & 63 | 128,
        codePoint >> 6 & 63 | 128,
        codePoint & 63 | 128,
      );
    } else {
      throw new Error("Invalid code point");
    }
  }
  return bytes;
}

function blitBuffer(src, dst, offset, byteLength) {
  let i;
  const length = byteLength === undefined ? src.length : byteLength;
  for (i = 0; i < length; ++i) {
    if (i + offset >= dst.length || i >= src.length) {
      break;
    }
    dst[i + offset] = src[i];
  }
  return i;
}

function isInstance(obj, type) {
  return obj instanceof type ||
    obj != null && obj.constructor != null &&
      obj.constructor.name != null && obj.constructor.name === type.name;
}

const hexSliceLookupTable = function () {
  const alphabet = "0123456789abcdef";
  const table = new Array(256);
  for (let i = 0; i < 16; ++i) {
    const i16 = i * 16;
    for (let j = 0; j < 16; ++j) {
      table[i16 + j] = alphabet[i] + alphabet[j];
    }
  }
  return table;
}();

function defineBigIntMethod(fn) {
  return typeof BigInt === "undefined" ? BufferBigIntNotDefined : fn;
}

function BufferBigIntNotDefined() {
  throw new Error("BigInt not supported");
}

export const atob = globalThis.atob;
export const Blob = globalThis.Blob;
export const btoa = globalThis.btoa;

export default {
  atob,
  btoa,
  Blob,
  Buffer,
  constants,
  kMaxLength,
  kStringMaxLength,
  SlowBuffer,
};
