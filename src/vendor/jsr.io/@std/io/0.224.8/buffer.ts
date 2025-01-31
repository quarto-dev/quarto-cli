// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { copy } from "jsr:@std/bytes@^1.0.2/copy";
import type { Reader, ReaderSync, Writer, WriterSync } from "./types.ts";

// MIN_READ is the minimum ArrayBuffer size passed to a read call by
// buffer.ReadFrom. As long as the Buffer has at least MIN_READ bytes beyond
// what is required to hold the contents of r, readFrom() will not grow the
// underlying buffer.
const MIN_READ = 32 * 1024;
const MAX_SIZE = 2 ** 32 - 2;

/**
 * A variable-sized buffer of bytes with `read()` and `write()` methods.
 *
 * Buffer is almost always used with some I/O like files and sockets. It allows
 * one to buffer up a download from a socket. Buffer grows and shrinks as
 * necessary.
 *
 * Buffer is NOT the same thing as Node's Buffer. Node's Buffer was created in
 * 2009 before JavaScript had the concept of ArrayBuffers. It's simply a
 * non-standard ArrayBuffer.
 *
 * ArrayBuffer is a fixed memory allocation. Buffer is implemented on top of
 * ArrayBuffer.
 *
 * Based on {@link https://golang.org/pkg/bytes/#Buffer | Go Buffer}.
 *
 * @example Usage
 * ```ts
 * import { Buffer } from "@std/io/buffer";
 * import { assertEquals } from "@std/assert/equals";
 *
 * const buf = new Buffer();
 * await buf.write(new TextEncoder().encode("Hello, "));
 * await buf.write(new TextEncoder().encode("world!"));
 *
 * const data = new Uint8Array(13);
 * await buf.read(data);
 *
 * assertEquals(new TextDecoder().decode(data), "Hello, world!");
 * ```
 */
export class Buffer implements Writer, WriterSync, Reader, ReaderSync {
  #buf: Uint8Array; // contents are the bytes buf[off : len(buf)]
  #off = 0; // read at buf[off], write at buf[buf.byteLength]

  /**
   * Constructs a new instance with the specified {@linkcode ArrayBuffer} as its
   * initial contents.
   *
   * @param ab The ArrayBuffer to use as the initial contents of the buffer.
   */
  constructor(ab?: ArrayBufferLike | ArrayLike<number>) {
    this.#buf = ab === undefined ? new Uint8Array(0) : new Uint8Array(ab);
  }

  /**
   * Returns a slice holding the unread portion of the buffer.
   *
   * The slice is valid for use only until the next buffer modification (that
   * is, only until the next call to a method like `read()`, `write()`,
   * `reset()`, or `truncate()`). If `options.copy` is false the slice aliases the buffer content at
   * least until the next buffer modification, so immediate changes to the
   * slice will affect the result of future reads.
   *
   * @example Usage
   * ```ts
   * import { Buffer } from "@std/io/buffer";
   * import { assertEquals } from "@std/assert/equals";
   *
   * const buf = new Buffer();
   * await buf.write(new TextEncoder().encode("Hello, world!"));
   *
   * const slice = buf.bytes();
   * assertEquals(new TextDecoder().decode(slice), "Hello, world!");
   * ```
   *
   * @param options The options for the slice.
   * @returns A slice holding the unread portion of the buffer.
   */
  bytes(options = { copy: true }): Uint8Array {
    if (options.copy === false) return this.#buf.subarray(this.#off);
    return this.#buf.slice(this.#off);
  }

  /**
   * Returns whether the unread portion of the buffer is empty.
   *
   * @example Usage
   * ```ts
   * import { Buffer } from "@std/io/buffer";
   * import { assertEquals } from "@std/assert/equals";
   *
   * const buf = new Buffer();
   * assertEquals(buf.empty(), true);
   * await buf.write(new TextEncoder().encode("Hello, world!"));
   * assertEquals(buf.empty(), false);
   * ```
   *
   * @returns `true` if the unread portion of the buffer is empty, `false`
   *          otherwise.
   */
  empty(): boolean {
    return this.#buf.byteLength <= this.#off;
  }

  /**
   * A read only number of bytes of the unread portion of the buffer.
   *
   * @example Usage
   * ```ts
   * import { Buffer } from "@std/io/buffer";
   * import { assertEquals } from "@std/assert/equals";
   *
   * const buf = new Buffer();
   * await buf.write(new TextEncoder().encode("Hello, world!"));
   *
   * assertEquals(buf.length, 13);
   * ```
   *
   * @returns The number of bytes of the unread portion of the buffer.
   */
  get length(): number {
    return this.#buf.byteLength - this.#off;
  }

  /**
   * The read only capacity of the buffer's underlying byte slice, that is,
   * the total space allocated for the buffer's data.
   *
   * @example Usage
   * ```ts
   * import { Buffer } from "@std/io/buffer";
   * import { assertEquals } from "@std/assert/equals";
   *
   * const buf = new Buffer();
   * assertEquals(buf.capacity, 0);
   * await buf.write(new TextEncoder().encode("Hello, world!"));
   * assertEquals(buf.capacity, 13);
   * ```
   *
   * @returns The capacity of the buffer.
   */
  get capacity(): number {
    return this.#buf.buffer.byteLength;
  }

  /**
   * Discards all but the first `n` unread bytes from the buffer but
   * continues to use the same allocated storage. It throws if `n` is
   * negative or greater than the length of the buffer.
   *
   * @example Usage
   * ```ts
   * import { Buffer } from "@std/io/buffer";
   * import { assertEquals } from "@std/assert/equals";
   *
   * const buf = new Buffer();
   * await buf.write(new TextEncoder().encode("Hello, world!"));
   * buf.truncate(6);
   * assertEquals(buf.length, 6);
   * ```
   *
   * @param n The number of bytes to keep.
   */
  truncate(n: number) {
    if (n === 0) {
      this.reset();
      return;
    }
    if (n < 0 || n > this.length) {
      throw new Error("Buffer truncation out of range");
    }
    this.#reslice(this.#off + n);
  }

  /**
   * Resets the contents
   *
   * @example Usage
   * ```ts
   * import { Buffer } from "@std/io/buffer";
   * import { assertEquals } from "@std/assert/equals";
   *
   * const buf = new Buffer();
   * await buf.write(new TextEncoder().encode("Hello, world!"));
   * buf.reset();
   * assertEquals(buf.length, 0);
   * ```
   */
  reset() {
    this.#reslice(0);
    this.#off = 0;
  }

  #tryGrowByReslice(n: number) {
    const l = this.#buf.byteLength;
    if (n <= this.capacity - l) {
      this.#reslice(l + n);
      return l;
    }
    return -1;
  }

  #reslice(len: number) {
    if (len > this.#buf.buffer.byteLength) {
      throw new RangeError("Length is greater than buffer capacity");
    }
    this.#buf = new Uint8Array(this.#buf.buffer, 0, len);
  }

  /**
   * Reads the next `p.length` bytes from the buffer or until the buffer is
   * drained. Returns the number of bytes read. If the buffer has no data to
   * return, the return is EOF (`null`).
   *
   * @example Usage
   * ```ts
   * import { Buffer } from "@std/io/buffer";
   * import { assertEquals } from "@std/assert/equals";
   *
   * const buf = new Buffer();
   * await buf.write(new TextEncoder().encode("Hello, world!"));
   *
   * const data = new Uint8Array(5);
   * const res = await buf.read(data);
   *
   * assertEquals(res, 5);
   * assertEquals(new TextDecoder().decode(data), "Hello");
   * ```
   *
   * @param p The buffer to read data into.
   * @returns The number of bytes read.
   */
  readSync(p: Uint8Array): number | null {
    if (this.empty()) {
      // Buffer is empty, reset to recover space.
      this.reset();
      if (p.byteLength === 0) {
        // this edge case is tested in 'bufferReadEmptyAtEOF' test
        return 0;
      }
      return null;
    }
    const nread = copy(this.#buf.subarray(this.#off), p);
    this.#off += nread;
    return nread;
  }

  /**
   * Reads the next `p.length` bytes from the buffer or until the buffer is
   * drained. Resolves to the number of bytes read. If the buffer has no
   * data to return, resolves to EOF (`null`).
   *
   * NOTE: This methods reads bytes synchronously; it's provided for
   * compatibility with `Reader` interfaces.
   *
   * @example Usage
   * ```ts
   * import { Buffer } from "@std/io/buffer";
   * import { assertEquals } from "@std/assert/equals";
   *
   * const buf = new Buffer();
   * await buf.write(new TextEncoder().encode("Hello, world!"));
   *
   * const data = new Uint8Array(5);
   * const res = await buf.read(data);
   *
   * assertEquals(res, 5);
   * assertEquals(new TextDecoder().decode(data), "Hello");
   * ```
   *
   * @param p The buffer to read data into.
   * @returns The number of bytes read.
   */
  read(p: Uint8Array): Promise<number | null> {
    const rr = this.readSync(p);
    return Promise.resolve(rr);
  }

  /**
   * Writes the given data to the buffer.
   *
   * @example Usage
   * ```ts
   * import { Buffer } from "@std/io/buffer";
   * import { assertEquals } from "@std/assert/equals";
   *
   * const buf = new Buffer();
   * const data = new TextEncoder().encode("Hello, world!");
   * buf.writeSync(data);
   *
   * const slice = buf.bytes();
   * assertEquals(new TextDecoder().decode(slice), "Hello, world!");
   * ```
   *
   * @param p The data to write to the buffer.
   * @returns The number of bytes written.
   */
  writeSync(p: Uint8Array): number {
    const m = this.#grow(p.byteLength);
    return copy(p, this.#buf, m);
  }

  /**
   * Writes the given data to the buffer. Resolves to the number of bytes
   * written.
   *
   * > [!NOTE]
   * > This methods writes bytes synchronously; it's provided for compatibility
   * > with the {@linkcode Writer} interface.
   *
   * @example Usage
   * ```ts
   * import { Buffer } from "@std/io/buffer";
   * import { assertEquals } from "@std/assert/equals";
   *
   * const buf = new Buffer();
   * const data = new TextEncoder().encode("Hello, world!");
   * await buf.write(data);
   *
   * const slice = buf.bytes();
   * assertEquals(new TextDecoder().decode(slice), "Hello, world!");
   * ```
   *
   * @param p The data to write to the buffer.
   * @returns The number of bytes written.
   */
  write(p: Uint8Array): Promise<number> {
    const n = this.writeSync(p);
    return Promise.resolve(n);
  }

  #grow(n: number) {
    const m = this.length;
    // If buffer is empty, reset to recover space.
    if (m === 0 && this.#off !== 0) {
      this.reset();
    }
    // Fast: Try to grow by means of a reslice.
    const i = this.#tryGrowByReslice(n);
    if (i >= 0) {
      return i;
    }
    const c = this.capacity;
    if (n <= Math.floor(c / 2) - m) {
      // We can slide things down instead of allocating a new
      // ArrayBuffer. We only need m+n <= c to slide, but
      // we instead let capacity get twice as large so we
      // don't spend all our time copying.
      copy(this.#buf.subarray(this.#off), this.#buf);
    } else if (c + n > MAX_SIZE) {
      throw new Error(
        `The buffer cannot be grown beyond the maximum size of "${MAX_SIZE}"`,
      );
    } else {
      // Not enough space anywhere, we need to allocate.
      const buf = new Uint8Array(Math.min(2 * c + n, MAX_SIZE));
      copy(this.#buf.subarray(this.#off), buf);
      this.#buf = buf;
    }
    // Restore this.#off and len(this.#buf).
    this.#off = 0;
    this.#reslice(Math.min(m + n, MAX_SIZE));
    return m;
  }

  /** Grows the buffer's capacity, if necessary, to guarantee space for
   * another `n` bytes. After `.grow(n)`, at least `n` bytes can be written to
   * the buffer without another allocation. If `n` is negative, `.grow()` will
   * throw. If the buffer can't grow it will throw an error.
   *
   * Based on Go Lang's
   * {@link https://golang.org/pkg/bytes/#Buffer.Grow | Buffer.Grow}.
   *
   * @example Usage
   * ```ts
   * import { Buffer } from "@std/io/buffer";
   * import { assertEquals } from "@std/assert/equals";
   *
   * const buf = new Buffer();
   * buf.grow(10);
   * assertEquals(buf.capacity, 10);
   * ```
   *
   * @param n The number of bytes to grow the buffer by.
   */
  grow(n: number) {
    if (n < 0) {
      throw new Error("Buffer growth cannot be negative");
    }
    const m = this.#grow(n);
    this.#reslice(m);
  }

  /**
   * Reads data from `r` until EOF (`null`) and appends it to the buffer,
   * growing the buffer as needed. It resolves to the number of bytes read.
   * If the buffer becomes too large, `.readFrom()` will reject with an error.
   *
   * Based on Go Lang's
   * {@link https://golang.org/pkg/bytes/#Buffer.ReadFrom | Buffer.ReadFrom}.
   *
   * @example Usage
   * ```ts
   * import { Buffer } from "@std/io/buffer";
   * import { StringReader } from "@std/io/string-reader";
   * import { assertEquals } from "@std/assert/equals";
   *
   * const buf = new Buffer();
   * const r = new StringReader("Hello, world!");
   * const n = await buf.readFrom(r);
   *
   * assertEquals(n, 13);
   * ```
   *
   * @param r The reader to read from.
   * @returns The number of bytes read.
   */
  async readFrom(r: Reader): Promise<number> {
    let n = 0;
    const tmp = new Uint8Array(MIN_READ);
    while (true) {
      const shouldGrow = this.capacity - this.length < MIN_READ;
      // read into tmp buffer if there's not enough room
      // otherwise read directly into the internal buffer
      const buf = shouldGrow
        ? tmp
        : new Uint8Array(this.#buf.buffer, this.length);

      const nread = await r.read(buf);
      if (nread === null) {
        return n;
      }

      // write will grow if needed
      if (shouldGrow) this.writeSync(buf.subarray(0, nread));
      else this.#reslice(this.length + nread);

      n += nread;
    }
  }

  /** Reads data from `r` until EOF (`null`) and appends it to the buffer,
   * growing the buffer as needed. It returns the number of bytes read. If the
   * buffer becomes too large, `.readFromSync()` will throw an error.
   *
   * Based on Go Lang's
   * {@link https://golang.org/pkg/bytes/#Buffer.ReadFrom | Buffer.ReadFrom}.
   *
   * @example Usage
   * ```ts
   * import { Buffer } from "@std/io/buffer";
   * import { StringReader } from "@std/io/string-reader";
   * import { assertEquals } from "@std/assert/equals";
   *
   * const buf = new Buffer();
   * const r = new StringReader("Hello, world!");
   * const n = buf.readFromSync(r);
   *
   * assertEquals(n, 13);
   * ```
   *
   * @param r The reader to read from.
   * @returns The number of bytes read.
   */
  readFromSync(r: ReaderSync): number {
    let n = 0;
    const tmp = new Uint8Array(MIN_READ);
    while (true) {
      const shouldGrow = this.capacity - this.length < MIN_READ;
      // read into tmp buffer if there's not enough room
      // otherwise read directly into the internal buffer
      const buf = shouldGrow
        ? tmp
        : new Uint8Array(this.#buf.buffer, this.length);

      const nread = r.readSync(buf);
      if (nread === null) {
        return n;
      }

      // write will grow if needed
      if (shouldGrow) this.writeSync(buf.subarray(0, nread));
      else this.#reslice(this.length + nread);

      n += nread;
    }
  }
}
