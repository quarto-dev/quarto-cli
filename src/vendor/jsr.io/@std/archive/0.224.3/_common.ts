// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

import { PartialReadError } from "jsr:/@std/io@^0.224.3/buf-reader";
import type { Reader } from "jsr:/@std/io@^0.224.3/types";

/** Base interface for {@linkcode TarMeta} */
export interface TarInfo {
  /**
   * The underlying raw `st_mode` bits that contain the standard Unix
   * permissions for this file/directory.
   */
  fileMode?: number;
  /**
   * Data modification time of the file at the time it was archived. It
   * represents the integer number of seconds since January 1, 1970, 00:00 UTC.
   */
  mtime?: number;
  /**
   * Numeric user ID of the file owner. This is ignored if the operating system
   * does not support numeric user IDs.
   */
  uid?: number;
  /**
   * Numeric group ID of the file owner. This is ignored if the operating
   * system does not support numeric group IDs.
   */
  gid?: number;
  /** The name of the file owner. */
  owner?: string;
  /** The group that the file owner belongs to. */
  group?: string;
  /**
   * The type of file archived.
   *
   * @see {@linkcode FileTypes}
   */
  type?: string;
}

/** Base interface for {@linkcode TarMetaWithLinkName}. */
export interface TarMeta extends TarInfo {
  /**
   * The name of the file, with directory names (if any) preceding the file
   * name, separated by slashes.
   */
  fileName: string;
  /**
   * The size of the file in bytes; for archive members that are symbolic or
   * hard links to another file, this field is specified as zero.
   */
  fileSize?: number;
}

/** The type of file archived. */
export enum FileTypes {
  "file" = 0,
  "link" = 1,
  "symlink" = 2,
  "character-device" = 3,
  "block-device" = 4,
  "directory" = 5,
  "fifo" = 6,
  "contiguous-file" = 7,
}

export const HEADER_LENGTH = 512;

/*
struct posix_header {           // byte offset
  char name[100];               //   0
  char mode[8];                 // 100
  char uid[8];                  // 108
  char gid[8];                  // 116
  char size[12];                // 124
  char mtime[12];               // 136
  char chksum[8];               // 148
  char typeflag;                // 156
  char linkname[100];           // 157
  char magic[6];                // 257
  char version[2];              // 263
  char uname[32];               // 265
  char gname[32];               // 297
  char devmajor[8];             // 329
  char devminor[8];             // 337
  char prefix[155];             // 345
                                // 500
};
*/

export const USTAR_STRUCTURE = [
  {
    field: "fileName",
    length: 100,
  },
  {
    field: "fileMode",
    length: 8,
  },
  {
    field: "uid",
    length: 8,
  },
  {
    field: "gid",
    length: 8,
  },
  {
    field: "fileSize",
    length: 12,
  },
  {
    field: "mtime",
    length: 12,
  },
  {
    field: "checksum",
    length: 8,
  },
  {
    field: "type",
    length: 1,
  },
  {
    field: "linkName",
    length: 100,
  },
  {
    field: "ustar",
    length: 8,
  },
  {
    field: "owner",
    length: 32,
  },
  {
    field: "group",
    length: 32,
  },
  {
    field: "majorNumber",
    length: 8,
  },
  {
    field: "minorNumber",
    length: 8,
  },
  {
    field: "fileNamePrefix",
    length: 155,
  },
  {
    field: "padding",
    length: 12,
  },
] as const;

/**
 * @internal
 */
export type UstarFields = (typeof USTAR_STRUCTURE)[number]["field"];

export async function readBlock(
  reader: Reader,
  p: Uint8Array,
): Promise<number | null> {
  let bytesRead = 0;
  while (bytesRead < p.length) {
    const rr = await reader.read(p.subarray(bytesRead));
    if (rr === null) {
      if (bytesRead === 0) {
        return null;
      } else {
        throw new PartialReadError();
      }
    }
    bytesRead += rr;
  }
  return bytesRead;
}
