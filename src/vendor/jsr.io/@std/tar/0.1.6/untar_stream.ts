// Copyright 2018-2025 the Deno authors. MIT license.
import { FixedChunkStream } from "jsr:@std/streams@^1.0.9/unstable-fixed-chunk-stream";

/**
 * The original tar	archive	header format.
 *
 * @experimental **UNSTABLE**: New API, yet to be vetted.
 */
export interface OldStyleFormat {
  /**
   * The name of the entry.
   */
  name: string;
  /**
   * The mode of the entry.
   */
  mode: number;
  /**
   * The uid of the entry.
   */
  uid: number;
  /**
   * The gid of the entry.
   */
  gid: number;
  /**
   * The size of the entry.
   */
  size: number;
  /**
   * The mtime of the entry.
   */
  mtime: number;
  /**
   * The typeflag of the entry.
   */
  typeflag: string;
  /**
   * The linkname of the entry.
   */
  linkname: string;
}

/**
 * The POSIX ustar archive header format.
 *
 * @experimental **UNSTABLE**: New API, yet to be vetted.
 */
export interface PosixUstarFormat {
  /**
   * The latter half of the name of the entry.
   */
  name: string;
  /**
   * The mode of the entry.
   */
  mode: number;
  /**
   * The uid of the entry.
   */
  uid: number;
  /**
   * The gid of the entry.
   */
  gid: number;
  /**
   * The size of the entry.
   */
  size: number;
  /**
   * The mtime of the entry.
   */
  mtime: number;
  /**
   * The typeflag of the entry.
   */
  typeflag: string;
  /**
   * The linkname of the entry.
   */
  linkname: string;
  /**
   * The magic number of the entry.
   */
  magic: string;
  /**
   * The version number of the entry.
   */
  version: string;
  /**
   * The uname of the entry.
   */
  uname: string;
  /**
   * The gname of the entry.
   */
  gname: string;
  /**
   * The devmajor of the entry.
   */
  devmajor: string;
  /**
   * The devminor of the entry.
   */
  devminor: string;
  /**
   * The former half of the name of the entry.
   */
  prefix: string;
}

/**
 * The structure of an entry extracted from a Tar archive.
 *
 * @experimental **UNSTABLE**: New API, yet to be vetted.
 */
export interface TarStreamEntry {
  /**
   * The header information attributed to the entry, presented in one of two
   * valid forms.
   */
  header: OldStyleFormat | PosixUstarFormat;
  /**
   * The path of the entry as stated in the archive.
   */
  path: string;
  /**
   * The content of the entry, if the entry is a file.
   */
  readable?: ReadableStream<Uint8Array>;
}

/**
 * ### Overview
 * A TransformStream to expand a tar archive.  Tar archives allow for storing
 * multiple files in a single file (called an archive, or sometimes a tarball).
 *
 * These archives typically have a single '.tar' extension.  This
 * implementation follows the [FreeBSD 15.0](https://man.freebsd.org/cgi/man.cgi?query=tar&sektion=5&apropos=0&manpath=FreeBSD+15.0-CURRENT) spec.
 *
 * ### Supported File Formats
 * Only the ustar file format is supported.  This is the most common format.
 * Additionally the numeric extension for file size.
 *
 * ### Usage
 * When expanding the archive, as demonstrated in the example, one must decide
 * to either consume the ReadableStream property, if present, or cancel it. The
 * next entry won't be resolved until the previous ReadableStream is either
 * consumed or cancelled.
 *
 * ### Understanding Compressed
 * A tar archive may be compressed, often identified by an additional file
 * extension, such as '.tar.gz' for gzip. This TransformStream does not support
 * decompression which must be done before expanding the archive.
 *
 * @experimental **UNSTABLE**: New API, yet to be vetted.
 *
 * @example Usage
 * ```ts ignore
 * import { UntarStream } from "@std/tar/untar-stream";
 * import { dirname, normalize } from "@std/path";
 *
 * for await (
 *   const entry of (await Deno.open("./out.tar.gz"))
 *     .readable
 *     .pipeThrough(new DecompressionStream("gzip"))
 *     .pipeThrough(new UntarStream())
 * ) {
 *   const path = normalize(entry.path);
 *   await Deno.mkdir(dirname(path), { recursive: true });
 *   await entry.readable?.pipeTo((await Deno.create(path)).writable);
 * }
 * ```
 */
export class UntarStream
  implements TransformStream<Uint8Array, TarStreamEntry> {
  #readable: ReadableStream<TarStreamEntry>;
  #writable: WritableStream<Uint8Array>;
  #reader: ReadableStreamDefaultReader<Uint8Array>;
  #buffer: Uint8Array[] = [];
  #lock = false;
  constructor() {
    const { readable, writable } = new TransformStream<
      Uint8Array,
      Uint8Array
    >();
    this.#readable = ReadableStream.from(this.#untar());
    this.#writable = writable;
    this.#reader = readable.pipeThrough(new FixedChunkStream(512)).getReader();
  }

  async #read(): Promise<Uint8Array | undefined> {
    const { done, value } = await this.#reader.read();
    if (done) return undefined;
    if (value.length !== 512) {
      throw new RangeError(
        `Cannot extract the tar archive: The tarball chunk has an unexpected number of bytes (${value.length})`,
      );
    }
    this.#buffer.push(value);
    return this.#buffer.shift();
  }

  async *#untar(): AsyncGenerator<TarStreamEntry> {
    for (let i = 0; i < 2; ++i) {
      const { done, value } = await this.#reader.read();
      if (done || value.length !== 512) {
        throw new RangeError(
          "Cannot extract the tar archive: The tarball is too small to be valid",
        );
      }
      this.#buffer.push(value);
    }
    const decoder = new TextDecoder();
    while (true) {
      while (this.#lock) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      // Check for premature ending
      if (this.#buffer.every((value) => value.every((x) => x === 0))) {
        await this.#reader.cancel("Tar stream finished prematurely");
        return;
      }

      const value = await this.#read();
      if (value == undefined) {
        if (this.#buffer.every((value) => value.every((x) => x === 0))) break;
        throw new TypeError(
          "Cannot extract the tar archive: The tarball has invalid ending",
        );
      }

      // Validate Checksum
      const checksum = parseInt(
        decoder.decode(value.subarray(148, 156)),
        8,
      );
      value.fill(32, 148, 156);
      if (value.reduce((x, y) => x + y) !== checksum) {
        throw new SyntaxError(
          "Cannot extract the tar archive: An archive entry has invalid header checksum",
        );
      }

      // Decode Header
      let header: OldStyleFormat | PosixUstarFormat = {
        name: decoder.decode(value.subarray(0, 100)).split("\0")[0]!,
        mode: parseInt(decoder.decode(value.subarray(100, 108)), 8),
        uid: parseInt(decoder.decode(value.subarray(108, 116)), 8),
        gid: parseInt(decoder.decode(value.subarray(116, 124)), 8),
        size: parseInt(decoder.decode(value.subarray(124, 136)).trimEnd(), 8),
        mtime: parseInt(decoder.decode(value.subarray(136, 148 - 1)), 8),
        typeflag: decoder.decode(value.subarray(156, 157)),
        linkname: decoder.decode(value.subarray(157, 257)).split("\0")[0]!,
      };
      if (header.typeflag === "\0") header.typeflag = "0";
      // "ustar\u000000"
      if (
        [117, 115, 116, 97, 114, 0, 48, 48].every((byte, i) =>
          value[i + 257] === byte
        )
      ) {
        header = {
          ...header,
          magic: decoder.decode(value.subarray(257, 263)),
          version: decoder.decode(value.subarray(263, 265)),
          uname: decoder.decode(value.subarray(265, 297)).split("\0")[0]!,
          gname: decoder.decode(value.subarray(297, 329)).split("\0")[0]!,
          devmajor: decoder.decode(value.subarray(329, 337)).replaceAll(
            "\0",
            "",
          ),
          devminor: decoder.decode(value.subarray(337, 345)).replaceAll(
            "\0",
            "",
          ),
          prefix: decoder.decode(value.subarray(345, 500)).split("\0")[0]!,
        };
      }

      const entry: TarStreamEntry = {
        path: (
          "prefix" in header && header.prefix.length ? header.prefix + "/" : ""
        ) + header.name,
        header,
      };
      if (!["1", "2", "3", "4", "5", "6"].includes(header.typeflag)) {
        entry.readable = this.#readableFile(header.size);
      }
      yield entry;
    }
  }

  async *#genFile(size: number): AsyncGenerator<Uint8Array> {
    for (let i = Math.ceil(size / 512); i > 0; --i) {
      const value = await this.#read();
      if (value == undefined) {
        throw new SyntaxError(
          "Cannot extract the tar archive: Unexpected end of Tarball",
        );
      }
      if (i === 1 && size % 512) yield value.subarray(0, size % 512);
      else yield value;
    }
  }

  #readableFile(size: number): ReadableStream<Uint8Array> {
    this.#lock = true;
    const releaseLock = () => this.#lock = false;
    const gen = this.#genFile(size);
    return new ReadableStream({
      type: "bytes",
      async pull(controller) {
        const { done, value } = await gen.next();
        if (done) {
          releaseLock();
          controller.close();
          return controller.byobRequest?.respond(0);
        }
        if (controller.byobRequest?.view) {
          const buffer = new Uint8Array(controller.byobRequest.view.buffer);

          const size = buffer.length;
          if (size < value.length) {
            buffer.set(value.slice(0, size));
            controller.byobRequest.respond(size);
            controller.enqueue(value.slice(size));
          } else {
            buffer.set(value);
            controller.byobRequest.respond(value.length);
          }
        } else {
          controller.enqueue(value);
        }
      },
      async cancel() {
        // deno-lint-ignore no-empty
        for await (const _ of gen) {}
        releaseLock();
      },
    });
  }

  /**
   * The ReadableStream
   *
   * @return ReadableStream<TarStreamChunk>
   *
   * @example Usage
   * ```ts ignore
   * import { UntarStream } from "@std/tar/untar-stream";
   * import { dirname, normalize } from "@std/path";
   *
   * for await (
   *   const entry of (await Deno.open("./out.tar.gz"))
   *     .readable
   *     .pipeThrough(new DecompressionStream("gzip"))
   *     .pipeThrough(new UntarStream())
   * ) {
   *   const path = normalize(entry.path);
   *   await Deno.mkdir(dirname(path), { recursive: true });
   *   await entry.readable?.pipeTo((await Deno.create(path)).writable);
   * }
   * ```
   */
  get readable(): ReadableStream<TarStreamEntry> {
    return this.#readable;
  }

  /**
   * The WritableStream
   *
   * @return WritableStream<Uint8Array>
   *
   * @example Usage
   * ```ts ignore
   * import { UntarStream } from "@std/tar/untar-stream";
   * import { dirname, normalize } from "@std/path";
   *
   * for await (
   *   const entry of (await Deno.open("./out.tar.gz"))
   *     .readable
   *     .pipeThrough(new DecompressionStream("gzip"))
   *     .pipeThrough(new UntarStream())
   * ) {
   *   const path = normalize(entry.path);
   *   await Deno.mkdir(dirname(path));
   *   await entry.readable?.pipeTo((await Deno.create(path)).writable);
   * }
   * ```
   */
  get writable(): WritableStream<Uint8Array> {
    return this.#writable;
  }
}
