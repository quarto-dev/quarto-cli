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
    this.name = this.constructor.name;
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
 * Asynchronously moves a file or directory.
 *
 * @param src The source file or directory as a string or URL.
 * @param dest The destination file or directory as a string or URL.
 * @param options Options for the move operation.
 * @returns A void promise that resolves once the operation completes.
 *
 * @example Basic usage
 * ```ts
 * import { move } from "@std/fs/move";
 *
 * await move("./foo", "./bar");
 * ```
 *
 * This will move the file or directory at `./foo` to `./bar` without
 * overwriting.
 *
 * @example Overwriting
 * ```ts
 * import { move } from "@std/fs/move";
 *
 * await move("./foo", "./bar", { overwrite: true });
 * ```
 *
 * This will move the file or directory at `./foo` to `./bar`, overwriting
 * `./bar` if it already exists.
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
 * Synchronously moves a file or directory.
 *
 * @param src The source file or directory as a string or URL.
 * @param dest The destination file or directory as a string or URL.
 * @param options Options for the move operation.
 * @returns A void value that returns once the operation completes.
 *
 * @example Basic usage
 * ```ts
 * import { moveSync } from "@std/fs/move";
 *
 * moveSync("./foo", "./bar");
 * ```
 *
 * This will move the file or directory at `./foo` to `./bar` without
 * overwriting.
 *
 * @example Overwriting
 * ```ts
 * import { moveSync } from "@std/fs/move";
 *
 * moveSync("./foo", "./bar", { overwrite: true });
 * ```
 *
 * This will move the file or directory at `./foo` to `./bar`, overwriting
 * `./bar` if it already exists.
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
