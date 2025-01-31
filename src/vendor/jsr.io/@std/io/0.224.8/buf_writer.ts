// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { copy } from "jsr:@std/bytes@^1.0.2/copy";
import type { Writer, WriterSync } from "./types.ts";

const DEFAULT_BUF_SIZE = 4096;

/**
 * AbstractBufBase is a base class which other classes can embed to
 * implement the {@inkcode Reader} and {@linkcode Writer} interfaces.
 * It provides basic implementations of those interfaces based on a buffer
 * array.
 *
 * @example Usage
 * ```ts no-assert
 * import { AbstractBufBase } from "@std/io/buf-writer";
 * import { Reader } from "@std/io/types";
 *
 * class MyBufReader extends AbstractBufBase {
 *   constructor(buf: Uint8Array) {
 *     super(buf);
 *   }
 * }
 * ```
 *
 * @internal
 */
export abstract class AbstractBufBase {
  /**
   * The buffer
   *
   * @example Usage
   * ```ts
   * import { AbstractBufBase } from "@std/io/buf-writer";
   * import { assertEquals } from "@std/assert/equals";
   *
   * class MyBuffer extends AbstractBufBase {}
   *
   * const buf = new Uint8Array(1024);
   * const mb = new MyBuffer(buf);
   *
   * assertEquals(mb.buf, buf);
   * ```
   */
  buf: Uint8Array;
  /**
   * The used buffer bytes
   *
   * @example Usage
   * ```ts
   * import { AbstractBufBase } from "@std/io/buf-writer";
   * import { assertEquals } from "@std/assert/equals";
   *
   * class MyBuffer extends AbstractBufBase {}
   *
   * const buf = new Uint8Array(1024);
   * const mb = new MyBuffer(buf);
   *
   * assertEquals(mb.usedBufferBytes, 0);
   * ```
   */
  usedBufferBytes = 0;
  /**
   * The error
   *
   * @example Usage
   * ```ts
   * import { AbstractBufBase } from "@std/io/buf-writer";
   * import { assertEquals } from "@std/assert/equals";
   *
   * class MyBuffer extends AbstractBufBase {}
   *
   * const buf = new Uint8Array(1024);
   * const mb = new MyBuffer(buf);
   *
   * assertEquals(mb.err, null);
   * ```
   */
  err: Error | null = null;

  /**
   * Construct a {@linkcode AbstractBufBase} instance
   *
   * @param buf The buffer to use.
   */
  constructor(buf: Uint8Array) {
    this.buf = buf;
  }

  /**
   * Size returns the size of the underlying buffer in bytes.
   *
   * @example Usage
   * ```ts
   * import { AbstractBufBase } from "@std/io/buf-writer";
   * import { assertEquals } from "@std/assert/equals";
   *
   * class MyBuffer extends AbstractBufBase {}
   *
   * const buf = new Uint8Array(1024);
   * const mb = new MyBuffer(buf);
   *
   * assertEquals(mb.size(), 1024);
   * ```
   *
   * @return the size of the buffer in bytes.
   */
  size(): number {
    return this.buf.byteLength;
  }

  /**
   * Returns how many bytes are unused in the buffer.
   *
   * @example Usage
   * ```ts
   * import { AbstractBufBase } from "@std/io/buf-writer";
   * import { assertEquals } from "@std/assert/equals";
   *
   * class MyBuffer extends AbstractBufBase {}
   *
   * const buf = new Uint8Array(1024);
   * const mb = new MyBuffer(buf);
   *
   * assertEquals(mb.available(), 1024);
   * ```
   *
   * @return the number of bytes that are unused in the buffer.
   */
  available(): number {
    return this.buf.byteLength - this.usedBufferBytes;
  }

  /**
   * buffered returns the number of bytes that have been written into the
   * current buffer.
   *
   * @example Usage
   * ```ts
   * import { AbstractBufBase } from "@std/io/buf-writer";
   * import { assertEquals } from "@std/assert/equals";
   *
   * class MyBuffer extends AbstractBufBase {}
   *
   * const buf = new Uint8Array(1024);
   * const mb = new MyBuffer(buf);
   *
   * assertEquals(mb.buffered(), 0);
   * ```
   *
   * @return the number of bytes that have been written into the current buffer.
   */
  buffered(): number {
    return this.usedBufferBytes;
  }
}

/**
 * `BufWriter` implements buffering for an {@linkcode Writer} object.
 * If an error occurs writing to a Writer, no more data will be
 * accepted and all subsequent writes, and flush(), will return the error.
 * After all data has been written, the client should call the
 * flush() method to guarantee all data has been forwarded to
 * the underlying deno.Writer.
 *
 * @example Usage
 * ```ts
 * import { BufWriter } from "@std/io/buf-writer";
 * import { assertEquals } from "@std/assert/equals";
 *
 * const writer = {
 *   write(p: Uint8Array): Promise<number> {
 *     return Promise.resolve(p.length);
 *   }
 * };
 *
 * const bufWriter = new BufWriter(writer);
 * const data = new Uint8Array(1024);
 *
 * await bufWriter.write(data);
 * await bufWriter.flush();
 *
 * assertEquals(bufWriter.buffered(), 0);
 * ```
 *
 * @deprecated This will be removed in 1.0.0. Use the {@link https://developer.mozilla.org/en-US/docs/Web/API/Streams_API | Web Streams API} instead.
 */
export class BufWriter extends AbstractBufBase implements Writer {
  #writer: Writer;

  /**
   * return new BufWriter unless writer is BufWriter
   *
   * @example Usage
   * ```ts
   * import { BufWriter } from "@std/io/buf-writer";
   * import { Writer } from "@std/io/types";
   * import { assertEquals } from "@std/assert/equals";
   *
   * const writer: Writer = {
   *   write(p: Uint8Array): Promise<number> {
   *     return Promise.resolve(p.length);
   *   }
   * };
   *
   * const bufWriter = BufWriter.create(writer);
   * const data = new Uint8Array(1024);
   *
   * await bufWriter.write(data);
   *
   * assertEquals(bufWriter.buffered(), 1024);
   * ```
   *
   * @param writer The writer to wrap.
   * @param size The size of the buffer.
   *
   * @return a new {@linkcode BufWriter} instance.
   */
  static create(writer: Writer, size: number = DEFAULT_BUF_SIZE): BufWriter {
    return writer instanceof BufWriter ? writer : new BufWriter(writer, size);
  }

  /**
   * Construct a new {@linkcode BufWriter}
   *
   * @param writer The writer to wrap.
   * @param size The size of the buffer.
   */
  constructor(writer: Writer, size: number = DEFAULT_BUF_SIZE) {
    super(new Uint8Array(size <= 0 ? DEFAULT_BUF_SIZE : size));
    this.#writer = writer;
  }

  /**
   * Discards any unflushed buffered data, clears any error, and
   * resets buffer to write its output to w.
   *
   * @example Usage
   * ```ts
   * import { BufWriter } from "@std/io/buf-writer";
   * import { Writer } from "@std/io/types";
   * import { assertEquals } from "@std/assert/equals";
   *
   * const writer: Writer = {
   *   write(p: Uint8Array): Promise<number> {
   *     return Promise.resolve(p.length);
   *   }
   * };
   *
   * const bufWriter = new BufWriter(writer);
   * const data = new Uint8Array(1024);
   *
   * await bufWriter.write(data);
   *
   * assertEquals(bufWriter.buffered(), 1024);
   *
   * bufWriter.reset(writer);
   *
   * assertEquals(bufWriter.buffered(), 0);
   * ```
   *
   * @param w The writer to write to.
   */
  reset(w: Writer) {
    this.err = null;
    this.usedBufferBytes = 0;
    this.#writer = w;
  }

  /**
   * Flush writes any buffered data to the underlying io.Writer.
   *
   * @example Usage
   * ```ts
   * import { BufWriter } from "@std/io/buf-writer";
   * import { Writer } from "@std/io/types";
   * import { assertEquals } from "@std/assert/equals";
   *
   * const writer: Writer = {
   *   write(p: Uint8Array): Promise<number> {
   *     return Promise.resolve(p.length);
   *   }
   * };
   *
   * const bufWriter = new BufWriter(writer);
   * const data = new Uint8Array(1024);
   *
   * await bufWriter.write(data);
   * await bufWriter.flush();
   *
   * assertEquals(bufWriter.buffered(), 0);
   * ```
   */
  async flush() {
    if (this.err !== null) throw this.err;
    if (this.usedBufferBytes === 0) return;

    try {
      const p = this.buf.subarray(0, this.usedBufferBytes);
      let nwritten = 0;
      while (nwritten < p.length) {
        nwritten += await this.#writer.write(p.subarray(nwritten));
      }
    } catch (e) {
      if (e instanceof Error) {
        this.err = e;
      }
      throw e;
    }

    this.buf = new Uint8Array(this.buf.length);
    this.usedBufferBytes = 0;
  }

  /**
   * Writes the contents of `data` into the buffer. If the contents won't fully
   * fit into the buffer, those bytes that are copied into the buffer will be flushed
   * to the writer and the remaining bytes are then copied into the now empty buffer.
   *
   * @example Usage
   * ```ts
   * import { BufWriter } from "@std/io/buf-writer";
   * import { Writer } from "@std/io/types";
   * import { assertEquals } from "@std/assert/equals";
   *
   * const writer: Writer = {
   *   write(p: Uint8Array): Promise<number> {
   *     return Promise.resolve(p.length);
   *   }
   * };
   *
   * const bufWriter = new BufWriter(writer);
   * const data = new Uint8Array(1024);
   *
   * await bufWriter.write(data);
   *
   * assertEquals(bufWriter.buffered(), 1024);
   * ```
   *
   * @param data The data to write to the buffer.
   * @return the number of bytes written to the buffer.
   */
  async write(data: Uint8Array): Promise<number> {
    if (this.err !== null) throw this.err;
    if (data.length === 0) return 0;

    let totalBytesWritten = 0;
    let numBytesWritten = 0;
    while (data.byteLength > this.available()) {
      if (this.buffered() === 0) {
        // Large write, empty buffer.
        // Write directly from data to avoid copy.
        try {
          numBytesWritten = await this.#writer.write(data);
        } catch (e) {
          if (e instanceof Error) {
            this.err = e;
          }
          throw e;
        }
      } else {
        numBytesWritten = copy(data, this.buf, this.usedBufferBytes);
        this.usedBufferBytes += numBytesWritten;
        await this.flush();
      }
      totalBytesWritten += numBytesWritten;
      data = data.subarray(numBytesWritten);
    }

    numBytesWritten = copy(data, this.buf, this.usedBufferBytes);
    this.usedBufferBytes += numBytesWritten;
    totalBytesWritten += numBytesWritten;
    return totalBytesWritten;
  }
}

/**
 * BufWriterSync implements buffering for a deno.WriterSync object.
 * If an error occurs writing to a WriterSync, no more data will be
 * accepted and all subsequent writes, and flush(), will return the error.
 * After all data has been written, the client should call the
 * flush() method to guarantee all data has been forwarded to
 * the underlying deno.WriterSync.
 *
 * @example Usage
 * ```ts
 * import { BufWriterSync } from "@std/io/buf-writer";
 * import { assertEquals } from "@std/assert/equals";
 *
 * const writer = {
 *   writeSync(p: Uint8Array): number {
 *     return p.length;
 *   }
 * };
 *
 * const bufWriter = new BufWriterSync(writer);
 * const data = new Uint8Array(1024);
 *
 * bufWriter.writeSync(data);
 * bufWriter.flush();
 *
 * assertEquals(bufWriter.buffered(), 0);
 * ```
 *
 * @deprecated This will be removed in 1.0.0. Use the {@link https://developer.mozilla.org/en-US/docs/Web/API/Streams_API | Web Streams API} instead.
 */
export class BufWriterSync extends AbstractBufBase implements WriterSync {
  #writer: WriterSync;

  /**
   * return new BufWriterSync unless writer is BufWriterSync
   *
   * @example Usage
   * ```ts
   * import { BufWriterSync } from "@std/io/buf-writer";
   * import { WriterSync } from "@std/io/types";
   * import { assertEquals } from "@std/assert/equals";
   *
   * const writer: WriterSync = {
   *   writeSync(p: Uint8Array): number {
   *     return p.length;
   *   }
   * };
   *
   * const bufWriter = BufWriterSync.create(writer);
   * const data = new Uint8Array(1024);
   * bufWriter.writeSync(data);
   * bufWriter.flush();
   *
   * assertEquals(bufWriter.buffered(), 0);
   * ```
   *
   * @param writer The writer to wrap.
   * @param size The size of the buffer.
   * @returns a new {@linkcode BufWriterSync} instance.
   */
  static create(
    writer: WriterSync,
    size: number = DEFAULT_BUF_SIZE,
  ): BufWriterSync {
    return writer instanceof BufWriterSync
      ? writer
      : new BufWriterSync(writer, size);
  }

  /**
   * Construct a new {@linkcode BufWriterSync}
   *
   * @param writer The writer to wrap.
   * @param size The size of the buffer.
   */
  constructor(writer: WriterSync, size: number = DEFAULT_BUF_SIZE) {
    super(new Uint8Array(size <= 0 ? DEFAULT_BUF_SIZE : size));
    this.#writer = writer;
  }

  /**
   * Discards any unflushed buffered data, clears any error, and
   * resets buffer to write its output to w.
   *
   * @example Usage
   * ```ts
   * import { BufWriterSync } from "@std/io/buf-writer";
   * import { WriterSync } from "@std/io/types";
   * import { assertEquals } from "@std/assert/equals";
   *
   * const writer: WriterSync = {
   *   writeSync(p: Uint8Array): number {
   *     return p.length;
   *   }
   * };
   *
   * const bufWriter = new BufWriterSync(writer);
   * const data = new Uint8Array(1024);
   *
   * bufWriter.writeSync(data);
   * bufWriter.flush();
   *
   * assertEquals(bufWriter.buffered(), 0);
   * ```
   *
   * @param w The writer to write to.
   */
  reset(w: WriterSync) {
    this.err = null;
    this.usedBufferBytes = 0;
    this.#writer = w;
  }

  /**
   * Flush writes any buffered data to the underlying io.WriterSync.
   *
   * @example Usage
   * ```ts
   * import { BufWriterSync } from "@std/io/buf-writer";
   * import { WriterSync } from "@std/io/types";
   * import { assertEquals } from "@std/assert/equals";
   *
   * const writer: WriterSync = {
   *   writeSync(p: Uint8Array): number {
   *     return p.length;
   *   }
   * };
   *
   * const bufWriter = new BufWriterSync(writer);
   * const data = new Uint8Array(1024);
   *
   * bufWriter.writeSync(data);
   * bufWriter.flush();
   *
   * assertEquals(bufWriter.buffered(), 0);
   * ```
   */
  flush() {
    if (this.err !== null) throw this.err;
    if (this.usedBufferBytes === 0) return;

    try {
      const p = this.buf.subarray(0, this.usedBufferBytes);
      let nwritten = 0;
      while (nwritten < p.length) {
        nwritten += this.#writer.writeSync(p.subarray(nwritten));
      }
    } catch (e) {
      if (e instanceof Error) {
        this.err = e;
      }
      throw e;
    }

    this.buf = new Uint8Array(this.buf.length);
    this.usedBufferBytes = 0;
  }

  /** Writes the contents of `data` into the buffer.  If the contents won't fully
   * fit into the buffer, those bytes that can are copied into the buffer, the
   * buffer is the flushed to the writer and the remaining bytes are copied into
   * the now empty buffer.
   *
   * @example Usage
   * ```ts
   * import { BufWriterSync } from "@std/io/buf-writer";
   * import { WriterSync } from "@std/io/types";
   * import { assertEquals } from "@std/assert/equals";
   *
   * const writer: WriterSync = {
   *   writeSync(p: Uint8Array): number {
   *     return p.length;
   *   }
   * };
   *
   * const bufWriter = new BufWriterSync(writer);
   * const data = new Uint8Array(1024);
   *
   * bufWriter.writeSync(data);
   * bufWriter.flush();
   *
   * assertEquals(bufWriter.buffered(), 0);
   * ```
   *
   * @param data The data to write to the buffer.
   * @return the number of bytes written to the buffer.
   */
  writeSync(data: Uint8Array): number {
    if (this.err !== null) throw this.err;
    if (data.length === 0) return 0;

    let totalBytesWritten = 0;
    let numBytesWritten = 0;
    while (data.byteLength > this.available()) {
      if (this.buffered() === 0) {
        // Large write, empty buffer.
        // Write directly from data to avoid copy.
        try {
          numBytesWritten = this.#writer.writeSync(data);
        } catch (e) {
          if (e instanceof Error) {
            this.err = e;
          }
          throw e;
        }
      } else {
        numBytesWritten = copy(data, this.buf, this.usedBufferBytes);
        this.usedBufferBytes += numBytesWritten;
        this.flush();
      }
      totalBytesWritten += numBytesWritten;
      data = data.subarray(numBytesWritten);
    }

    numBytesWritten = copy(data, this.buf, this.usedBufferBytes);
    this.usedBufferBytes += numBytesWritten;
    totalBytesWritten += numBytesWritten;
    return totalBytesWritten;
  }
}
