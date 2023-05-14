// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.

import {
  FileTypes,
  type TarInfo,
  type TarMeta,
  type TarOptions,
  ustarStructure,
} from "./_common.ts";
import type { Reader } from "../types.d.ts";

export { type TarInfo, type TarMeta, type TarOptions };

/*!
 * Ported and modified from: https://github.com/beatgammit/tar-js and
 * licensed as:
 *
 * (The MIT License)
 *
 * Copyright (c) 2011 T. Jameson Little
 * Copyright (c) 2019 Jun Kato
 * Copyright (c) 2018-2022 the Deno authors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

import { MultiReader } from "../io/multi_reader.ts";
import { Buffer } from "../io/buffer.ts";
import { assert } from "../_util/asserts.ts";
import { recordSize } from "./_common.ts";

const ustar = "ustar\u000000";

/**
 * Simple file reader
 */
class FileReader implements Reader {
  #file?: Deno.FsFile;

  constructor(private filePath: string) {}

  public async read(p: Uint8Array): Promise<number | null> {
    if (!this.#file) {
      this.#file = await Deno.open(this.filePath, { read: true });
    }
    const res = await this.#file.read(p);
    if (res === null) {
      this.#file.close();
      this.#file = undefined;
    }
    return res;
  }
}

/**
 * Initialize Uint8Array of the specified length filled with 0
 * @param length
 */
function clean(length: number): Uint8Array {
  const buffer = new Uint8Array(length);
  buffer.fill(0, 0, length - 1);
  return buffer;
}

function pad(num: number, bytes: number, base = 8): string {
  const numString = num.toString(base);
  return "000000000000".slice(numString.length + 12 - bytes) + numString;
}

/**
 * Create header for a file in a tar archive
 */
function formatHeader(data: TarData): Uint8Array {
  const encoder = new TextEncoder(),
    buffer = clean(512);
  let offset = 0;
  ustarStructure.forEach(function (value) {
    const entry = encoder.encode(data[value.field as keyof TarData] || "");
    buffer.set(entry, offset);
    offset += value.length; // space it out with nulls
  });
  return buffer;
}

export interface TarData {
  fileName?: string;
  fileNamePrefix?: string;
  fileMode?: string;
  uid?: string;
  gid?: string;
  fileSize?: string;
  mtime?: string;
  checksum?: string;
  type?: string;
  ustar?: string;
  owner?: string;
  group?: string;
}

export interface TarDataWithSource extends TarData {
  /**
   * file to read
   */
  filePath?: string;
  /**
   * buffer to read
   */
  reader?: Reader;
}

/**
 * A class to create a tar archive
 *
 * @example
 * ```ts
 * import { Tar } from "https://deno.land/std@$STD_VERSION/archive/tar.ts";
 * import { Buffer } from "https://deno.land/std@$STD_VERSION/io/buffer.ts";
 * import { copy } from "https://deno.land/std@$STD_VERSION/streams/copy.ts";
 *
 * const tar = new Tar();
 * const content = new TextEncoder().encode("Deno.land");
 * await tar.append("deno.txt", {
 *   reader: new Buffer(content),
 *   contentSize: content.byteLength,
 * });
 *
 * // Or specifying a filePath.
 * await tar.append("land.txt", {
 *   filePath: "./land.txt",
 * });
 *
 * // use tar.getReader() to read the contents.
 *
 * const writer = await Deno.open("./out.tar", { write: true, create: true });
 * await copy(tar.getReader(), writer);
 * writer.close();
 * ```
 */
export class Tar {
  data: TarDataWithSource[];

  constructor() {
    this.data = [];
  }

  /**
   * Append a file to this tar archive
   * @param fn file name
   *                 e.g., test.txt; use slash for directory separators
   * @param opts options
   */
  async append(fn: string, opts: TarOptions) {
    if (typeof fn !== "string") {
      throw new Error("file name not specified");
    }
    let fileName = fn;
    // separate file name into two parts if needed
    let fileNamePrefix: string | undefined;
    if (fileName.length > 100) {
      let i = fileName.length;
      while (i >= 0) {
        i = fileName.lastIndexOf("/", i);
        if (i <= 155) {
          fileNamePrefix = fileName.slice(0, i);
          fileName = fileName.slice(i + 1);
          break;
        }
        i--;
      }
      const errMsg =
        "ustar format does not allow a long file name (length of [file name" +
        "prefix] + / + [file name] must be shorter than 256 bytes)";
      if (i < 0 || fileName.length > 100) {
        throw new Error(errMsg);
      } else {
        assert(fileNamePrefix != null);
        if (fileNamePrefix.length > 155) {
          throw new Error(errMsg);
        }
      }
    }

    opts = opts || {};

    // set meta data
    let info: Deno.FileInfo | undefined;
    if (opts.filePath) {
      info = await Deno.stat(opts.filePath);
      if (info.isDirectory) {
        info.size = 0;
        opts.reader = new Buffer();
      }
    }

    const mode = opts.fileMode || (info && info.mode) ||
        parseInt("777", 8) & 0xfff,
      mtime = Math.floor(
        opts.mtime ?? (info?.mtime ?? new Date()).valueOf() / 1000,
      ),
      uid = opts.uid || 0,
      gid = opts.gid || 0;
    if (typeof opts.owner === "string" && opts.owner.length >= 32) {
      throw new Error(
        "ustar format does not allow owner name length >= 32 bytes",
      );
    }
    if (typeof opts.group === "string" && opts.group.length >= 32) {
      throw new Error(
        "ustar format does not allow group name length >= 32 bytes",
      );
    }

    const fileSize = info?.size ?? opts.contentSize;
    assert(fileSize != null, "fileSize must be set");

    const type = opts.type
      ? FileTypes[opts.type as keyof typeof FileTypes]
      : (info?.isDirectory ? FileTypes.directory : FileTypes.file);
    const tarData: TarDataWithSource = {
      fileName,
      fileNamePrefix,
      fileMode: pad(mode, 7),
      uid: pad(uid, 7),
      gid: pad(gid, 7),
      fileSize: pad(fileSize, 11),
      mtime: pad(mtime, 11),
      checksum: "        ",
      type: type.toString(),
      ustar,
      owner: opts.owner || "",
      group: opts.group || "",
      filePath: opts.filePath,
      reader: opts.reader,
    };

    // calculate the checksum
    let checksum = 0;
    const encoder = new TextEncoder();
    Object.keys(tarData)
      .filter((key): boolean => ["filePath", "reader"].indexOf(key) < 0)
      .forEach(function (key) {
        checksum += encoder
          .encode(tarData[key as keyof TarData])
          .reduce((p, c): number => p + c, 0);
      });

    tarData.checksum = pad(checksum, 6) + "\u0000 ";
    this.data.push(tarData);
  }

  /**
   * Get a Reader instance for this tar data
   */
  getReader(): Reader {
    const readers: Reader[] = [];
    this.data.forEach((tarData) => {
      let { reader } = tarData;
      const { filePath } = tarData;
      const headerArr = formatHeader(tarData);
      readers.push(new Buffer(headerArr));
      if (!reader) {
        assert(filePath != null);
        reader = new FileReader(filePath);
      }
      readers.push(reader);

      // to the nearest multiple of recordSize
      assert(tarData.fileSize != null, "fileSize must be set");
      readers.push(
        new Buffer(
          clean(
            recordSize -
              (parseInt(tarData.fileSize, 8) % recordSize || recordSize),
          ),
        ),
      );
    });

    // append 2 empty records
    readers.push(new Buffer(clean(recordSize * 2)));
    return new MultiReader(readers);
  }
}
