// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
import { isSubdir } from "./_is_subdir.ts";
import { isSamePath } from "./_is_same_path.ts";

const EXISTS_ERROR = new Deno.errors.AlreadyExists("dest already exists.");

/**
 * Error thrown in {@linkcode move} or {@linkcode moveSync} when the
 * destination is a subdirectory of the source.
 */
export class SubdirectoryMoveError extends Error {
  /** Constructs a new instance. */
  constructor(src: string | URL, dest: string | URL) {
    super(
      `Cannot move '${src}' to a subdirectory of itself, '${dest}'.`,
    );
  }
}

/** Options for {@linkcode move} and {@linkcode moveSync}. */
export interface MoveOptions {
  /**
   * Whether the destination file should be overwritten if it already exists.
   *
   * @default {false}
   */
  overwrite?: boolean;
}

/**
 * Moves a file or directory.
 *
 * @example
 * ```ts
 * import { move } from "https://deno.land/std@$STD_VERSION/fs/mod.ts";
 *
 * move("./foo", "./bar"); // returns a promise
 * ```
 */
export async function move(
  src: string | URL,
  dest: string | URL,
  { overwrite = false }: MoveOptions = {},
): Promise<void> {
  const srcStat = await Deno.stat(src);

  if (
    srcStat.isDirectory &&
    (isSubdir(src, dest) || isSamePath(src, dest))
  ) {
    throw new SubdirectoryMoveError(src, dest);
  }

  if (overwrite) {
    if (isSamePath(src, dest)) return;
    try {
      await Deno.remove(dest, { recursive: true });
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
    }
  } else {
    try {
      await Deno.lstat(dest);
      return Promise.reject(EXISTS_ERROR);
    } catch {
      // Do nothing...
    }
  }

  await Deno.rename(src, dest);
}

/**
 * Moves a file or directory synchronously.
 *
 * @example
 * ```ts
 * import { moveSync } from "https://deno.land/std@$STD_VERSION/fs/mod.ts";
 *
 * moveSync("./foo", "./bar"); // void
 * ```
 */
export function moveSync(
  src: string | URL,
  dest: string | URL,
  { overwrite = false }: MoveOptions = {},
): void {
  const srcStat = Deno.statSync(src);

  if (
    srcStat.isDirectory &&
    (isSubdir(src, dest) || isSamePath(src, dest))
  ) {
    throw new SubdirectoryMoveError(src, dest);
  }

  if (overwrite) {
    if (isSamePath(src, dest)) return;
    try {
      Deno.removeSync(dest, { recursive: true });
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
    }
  } else {
    try {
      Deno.lstatSync(dest);
      throw EXISTS_ERROR;
    } catch (error) {
      if (error === EXISTS_ERROR) {
        throw error;
      }
    }
  }

  Deno.renameSync(src, dest);
}
