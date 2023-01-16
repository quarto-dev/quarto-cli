// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright Joyent, Inc. and other Node contributors.
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

// This module ports:
// - https://github.com/nodejs/node/blob/master/src/stream_base-inl.h
// - https://github.com/nodejs/node/blob/master/src/stream_base.h
// - https://github.com/nodejs/node/blob/master/src/stream_base.cc
// - https://github.com/nodejs/node/blob/master/src/stream_wrap.h
// - https://github.com/nodejs/node/blob/master/src/stream_wrap.cc

import { Buffer } from "../buffer.ts";
import { notImplemented } from "../_utils.ts";
import { HandleWrap } from "./handle_wrap.ts";
import { AsyncWrap, providerType } from "./async_wrap.ts";
import { codeMap } from "./uv.ts";
import { writeAll } from "../../streams/conversion.ts";

enum StreamBaseStateFields {
  kReadBytesOrError,
  kArrayBufferOffset,
  kBytesWritten,
  kLastWriteWasAsync,
  kNumStreamBaseStateFields,
}

export const kReadBytesOrError = StreamBaseStateFields.kReadBytesOrError;
export const kArrayBufferOffset = StreamBaseStateFields.kArrayBufferOffset;
export const kBytesWritten = StreamBaseStateFields.kBytesWritten;
export const kLastWriteWasAsync = StreamBaseStateFields.kLastWriteWasAsync;
export const kNumStreamBaseStateFields =
  StreamBaseStateFields.kNumStreamBaseStateFields;

export const streamBaseState = new Uint8Array(5);

// This is Deno, it always will be async.
streamBaseState[kLastWriteWasAsync] = 1;

export class WriteWrap<H extends HandleWrap> extends AsyncWrap {
  handle!: H;
  oncomplete!: (status: number) => void;
  async!: boolean;
  bytes!: number;
  buffer!: unknown;
  callback!: unknown;
  _chunks!: unknown[];

  constructor() {
    super(providerType.WRITEWRAP);
  }
}

export class ShutdownWrap<H extends HandleWrap> extends AsyncWrap {
  handle!: H;
  oncomplete!: (status: number) => void;
  callback!: () => void;

  constructor() {
    super(providerType.SHUTDOWNWRAP);
  }
}

export const kStreamBaseField = Symbol("kStreamBaseField");

const SUGGESTED_SIZE = 64 * 1024;

export class LibuvStreamWrap extends HandleWrap {
  [kStreamBaseField]?: Deno.Reader & Deno.Writer & Deno.Closer;

  reading!: boolean;
  #reading = false;
  destroyed = false;
  writeQueueSize = 0;
  bytesRead = 0;
  bytesWritten = 0;

  onread!: (_arrayBuffer: Uint8Array, _nread: number) => Uint8Array | undefined;

  constructor(
    provider: providerType,
    stream?: Deno.Reader & Deno.Writer & Deno.Closer,
  ) {
    super(provider);
    this.#attachToObject(stream);
  }

  /**
   * Start the reading of the stream.
   * @return An error status code.
   */
  readStart(): number {
    if (!this.#reading) {
      this.#reading = true;
      this.#read();
    }

    return 0;
  }

  /**
   * Stop the reading of the stream.
   * @return An error status code.
   */
  readStop(): number {
    this.#reading = false;

    return 0;
  }

  /**
   * Shutdown the stream.
   * @param req A shutdown request wrapper.
   * @return An error status code.
   */
  shutdown(req: ShutdownWrap<LibuvStreamWrap>): number {
    const status = this._onClose();

    try {
      req.oncomplete(status);
    } catch {
      // swallow callback error.
    }

    return 0;
  }

  /**
   * @param userBuf
   * @return An error status code.
   */
  useUserBuffer(_userBuf: unknown): number {
    // TODO(cmorten)
    notImplemented("LibuvStreamWrap.prototype.useUserBuffer");
  }

  /**
   * Write a buffer to the stream.
   * @param req A write request wrapper.
   * @param data The Uint8Array buffer to write to the stream.
   * @return An error status code.
   */
  writeBuffer(req: WriteWrap<LibuvStreamWrap>, data: Uint8Array): number {
    this.#write(req, data);

    return 0;
  }

  /**
   * Write multiple chunks at once.
   * @param req A write request wrapper.
   * @param chunks
   * @param allBuffers
   * @return An error status code.
   */
  writev(
    req: WriteWrap<LibuvStreamWrap>,
    chunks: Buffer[] | (string | Buffer)[],
    allBuffers: boolean,
  ): number {
    const count = allBuffers ? chunks.length : chunks.length >> 1;
    const buffers: Buffer[] = new Array(count);

    if (!allBuffers) {
      for (let i = 0; i < count; i++) {
        const chunk = chunks[i * 2];

        if (Buffer.isBuffer(chunk)) {
          buffers[i] = chunk;
        }

        // String chunk
        const encoding: string = chunks[i * 2 + 1] as string;
        buffers[i] = Buffer.from(chunk as string, encoding);
      }
    } else {
      for (let i = 0; i < count; i++) {
        buffers[i] = chunks[i] as Buffer;
      }
    }

    return this.writeBuffer(req, Buffer.concat(buffers));
  }

  /**
   * Write an ASCII string to the stream.
   * @return An error status code.
   */
  writeAsciiString(req: WriteWrap<LibuvStreamWrap>, data: string): number {
    const buffer = new TextEncoder().encode(data);

    return this.writeBuffer(req, buffer);
  }

  /**
   * Write an UTF8 string to the stream.
   * @return An error status code.
   */
  writeUtf8String(req: WriteWrap<LibuvStreamWrap>, data: string): number {
    const buffer = new TextEncoder().encode(data);

    return this.writeBuffer(req, buffer);
  }

  /**
   * Write an UCS2 string to the stream.
   * @return An error status code.
   */
  writeUcs2String(_req: WriteWrap<LibuvStreamWrap>, _data: string): number {
    notImplemented("LibuvStreamWrap.prototype.writeUcs2String");
  }

  /**
   * Write an LATIN1 string to the stream.
   * @return An error status code.
   */
  writeLatin1String(req: WriteWrap<LibuvStreamWrap>, data: string): number {
    const buffer = Buffer.from(data, "latin1");
    return this.writeBuffer(req, buffer);
  }

  override _onClose(): number {
    let status = 0;
    this.#reading = false;

    try {
      this[kStreamBaseField]?.close();
    } catch {
      status = codeMap.get("ENOTCONN")!;
    }

    return status;
  }

  /**
   * Attaches the class to the underlying stream.
   * @param stream The stream to attach to.
   */
  #attachToObject(stream?: Deno.Reader & Deno.Writer & Deno.Closer) {
    this[kStreamBaseField] = stream;
  }

  /** Internal method for reading from the attached stream. */
  async #read() {
    let buf = new Uint8Array(SUGGESTED_SIZE);

    let nread: number | null;
    try {
      nread = await this[kStreamBaseField]!.read(buf);
    } catch (e) {
      if (
        e instanceof Deno.errors.Interrupted ||
        e instanceof Deno.errors.BadResource
      ) {
        nread = codeMap.get("EOF")!;
      } else if (
        e instanceof Deno.errors.ConnectionReset ||
        e instanceof Deno.errors.ConnectionAborted
      ) {
        nread = codeMap.get("ECONNRESET")!;
      } else {
        nread = codeMap.get("UNKNOWN")!;
      }

      buf = new Uint8Array(0);
    }

    nread ??= codeMap.get("EOF")!;

    streamBaseState[kReadBytesOrError] = nread;

    if (nread > 0) {
      this.bytesRead += nread;
    }

    buf = buf.slice(0, nread);

    streamBaseState[kArrayBufferOffset] = 0;

    try {
      this.onread!(buf, nread);
    } catch {
      // swallow callback errors.
    }

    if (nread >= 0 && this.#reading) {
      this.#read();
    }
  }

  /**
   * Internal method for writing to the attached stream.
   * @param req A write request wrapper.
   * @param data The Uint8Array buffer to write to the stream.
   */
  async #write(req: WriteWrap<LibuvStreamWrap>, data: Uint8Array) {
    const { byteLength } = data;

    try {
      await writeAll(this[kStreamBaseField]!, data);
    } catch (e) {
      let status: number;

      // TODO(cmorten): map err to status codes
      if (
        e instanceof Deno.errors.BadResource ||
        e instanceof Deno.errors.BrokenPipe
      ) {
        status = codeMap.get("EBADF")!;
      } else {
        status = codeMap.get("UNKNOWN")!;
      }

      try {
        req.oncomplete(status);
      } catch {
        // swallow callback errors.
      }

      return;
    }

    streamBaseState[kBytesWritten] = byteLength;
    this.bytesWritten += byteLength;

    try {
      req.oncomplete(0);
    } catch {
      // swallow callback errors.
    }

    return;
  }
}
