// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright Joyent, Inc. and Node.js contributors. All rights reserved. MIT license.
import { Buffer } from "../buffer.ts";
import { validateEncoding, validateInteger } from "../internal/validators.mjs";
import {
  getValidatedFd,
  showStringCoercionDeprecation,
  validateOffsetLengthWrite,
  validateStringAfterArrayBufferView,
} from "../internal/fs/utils.mjs";
import { isArrayBufferView } from "../internal/util/types.ts";
import { maybeCallback } from "./_fs_common.ts";

export function writeSync(fd, buffer, offset, length, position) {
  fd = getValidatedFd(fd);

  const innerWriteSync = (fd, buffer, offset, length, position) => {
    if (buffer instanceof DataView) {
      buffer = new Uint8Array(buffer.buffer);
    }
    if (typeof position === "number") {
      Deno.seekSync(fd, position, Deno.SeekMode.Start);
    }
    let currentOffset = offset;
    const end = offset + length;
    while (currentOffset - offset < length) {
      currentOffset += Deno.writeSync(fd, buffer.subarray(currentOffset, end));
    }
    return currentOffset - offset;
  };

  if (isArrayBufferView(buffer)) {
    if (position === undefined) {
      position = null;
    }
    if (offset == null) {
      offset = 0;
    } else {
      validateInteger(offset, "offset", 0);
    }
    if (typeof length !== "number") {
      length = buffer.byteLength - offset;
    }
    validateOffsetLengthWrite(offset, length, buffer.byteLength);
    return innerWriteSync(fd, buffer, offset, length, position);
  }
  validateStringAfterArrayBufferView(buffer, "buffer");
  validateEncoding(buffer, length);
  if (offset === undefined) {
    offset = null;
  }
  buffer = Buffer.from(buffer, length);
  return innerWriteSync(fd, buffer, 0, buffer.length, position);
}

/** Writes the buffer to the file of the given descriptor.
 * https://nodejs.org/api/fs.html#fswritefd-buffer-offset-length-position-callback
 * https://github.com/nodejs/node/blob/42ad4137aadda69c51e1df48eee9bc2e5cebca5c/lib/fs.js#L797
 */
export function write(fd, buffer, offset, length, position, callback) {
  fd = getValidatedFd(fd);

  const innerWrite = async (fd, buffer, offset, length, position) => {
    if (buffer instanceof DataView) {
      buffer = new Uint8Array(buffer.buffer);
    }
    if (typeof position === "number") {
      await Deno.seek(fd, position, Deno.SeekMode.Start);
    }
    let currentOffset = offset;
    const end = offset + length;
    while (currentOffset - offset < length) {
      currentOffset += await Deno.write(
        fd,
        buffer.subarray(currentOffset, end),
      );
    }
    return currentOffset - offset;
  };

  if (isArrayBufferView(buffer)) {
    callback = maybeCallback(callback || position || length || offset);
    if (offset == null || typeof offset === "function") {
      offset = 0;
    } else {
      validateInteger(offset, "offset", 0);
    }
    if (typeof length !== "number") {
      length = buffer.byteLength - offset;
    }
    if (typeof position !== "number") {
      position = null;
    }
    validateOffsetLengthWrite(offset, length, buffer.byteLength);
    innerWrite(fd, buffer, offset, length, position).then(
      (nwritten) => {
        callback(null, nwritten, buffer);
      },
      (err) => callback(err),
    );
    return;
  }

  // Here the call signature is
  // `fs.write(fd, string[, position[, encoding]], callback)`

  validateStringAfterArrayBufferView(buffer, "buffer");
  if (typeof buffer !== "string") {
    showStringCoercionDeprecation();
  }

  if (typeof position !== "function") {
    if (typeof offset === "function") {
      position = offset;
      offset = null;
    } else {
      position = length;
    }
    length = "utf-8";
  }

  const str = String(buffer);
  validateEncoding(str, length);
  callback = maybeCallback(position);
  buffer = Buffer.from(str, length);
  innerWrite(fd, buffer, 0, buffer.length, offset, callback).then(
    (nwritten) => {
      callback(null, nwritten, buffer);
    },
    (err) => callback(err),
  );
}
