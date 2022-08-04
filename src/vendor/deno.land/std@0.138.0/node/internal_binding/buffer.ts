// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { Encodings } from "./_node.ts";
import { indexOfNeedle } from "../../bytes/mod.ts";

export function numberToBytes(n: number): Uint8Array {
  if (n === 0) return new Uint8Array([0]);

  const bytes = [];
  bytes.unshift(n & 255);
  while (n >= 256) {
    n = n >>> 8;
    bytes.unshift(n & 255);
  }
  return new Uint8Array(bytes);
}

// TODO(Soremwar)
// Check if offset or buffer can be transform in order to just use std's lastIndexOf directly
// This implementation differs from std's lastIndexOf in the fact that
// it also includes items outside of the offset as long as part of the
// set is contained inside of the offset
// Probably way slower too
function findLastIndex(
  targetBuffer: Uint8Array,
  buffer: Uint8Array,
  offset: number,
) {
  offset = offset > targetBuffer.length ? targetBuffer.length : offset;

  const searchableBuffer = targetBuffer.slice(0, offset + buffer.length);
  const searchableBufferLastIndex = searchableBuffer.length - 1;
  const bufferLastIndex = buffer.length - 1;

  // Important to keep track of the last match index in order to backtrack after an incomplete match
  // Not doing this will cause the search to skip all possible matches that happened in the
  // last match range
  let lastMatchIndex = -1;
  let matches = 0;
  let index = -1;
  for (let x = 0; x <= searchableBufferLastIndex; x++) {
    if (
      searchableBuffer[searchableBufferLastIndex - x] ===
        buffer[bufferLastIndex - matches]
    ) {
      if (lastMatchIndex === -1) {
        lastMatchIndex = x;
      }
      matches++;
    } else {
      matches = 0;
      if (lastMatchIndex !== -1) {
        // Restart the search right after the last index was ignored
        x = lastMatchIndex + 1;
        lastMatchIndex = -1;
      }
      continue;
    }

    if (matches === buffer.length) {
      index = x;
      break;
    }
  }

  if (index === -1) return index;

  return searchableBufferLastIndex - index;
}

// TODO
// Take encoding into account when evaluating index
function indexOfBuffer(
  targetBuffer: Uint8Array,
  buffer: Uint8Array,
  byteOffset: number,
  encoding: Encodings,
  forwardDirection: boolean,
) {
  if (!Encodings[encoding] === undefined) {
    throw new Error(`Unknown encoding code ${encoding}`);
  }

  if (!forwardDirection) {
    // If negative the offset is calculated from the end of the buffer

    if (byteOffset < 0) {
      byteOffset = targetBuffer.length + byteOffset;
    }

    if (buffer.length === 0) {
      return byteOffset <= targetBuffer.length
        ? byteOffset
        : targetBuffer.length;
    }

    return findLastIndex(targetBuffer, buffer, byteOffset);
  }

  if (buffer.length === 0) {
    return byteOffset <= targetBuffer.length ? byteOffset : targetBuffer.length;
  }

  return indexOfNeedle(targetBuffer, buffer, byteOffset);
}

// TODO(Soremwar)
// Node's implementation is a very obscure algorithm that I haven't been able to crack just yet
function indexOfNumber(
  targetBuffer: Uint8Array,
  number: number,
  byteOffset: number,
  forwardDirection: boolean,
) {
  const bytes = numberToBytes(number);

  if (bytes.length > 1) {
    throw new Error("Multi byte number search is not supported");
  }

  return indexOfBuffer(
    targetBuffer,
    numberToBytes(number),
    byteOffset,
    Encodings.UTF8,
    forwardDirection,
  );
}

export default { indexOfBuffer, indexOfNumber };
export { indexOfBuffer, indexOfNumber };
