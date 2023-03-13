// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.

/**
 * Test whether or not the given path exists by checking with the file system.
 *
 * Note: do not use this function if performing a check before another operation on that file. Doing so creates a race condition. Instead, perform the actual file operation directly.
 *
 * Bad:
 * ```ts
 * import { exists } from "https://deno.land/std@$STD_VERSION/fs/mod.ts";
 *
 * if (await exists("./foo.txt")) {
 *   await Deno.remove("./foo.txt");
 * }
 * ```
 *
 * Good:
 * ```ts
 * // Notice no use of exists
 * try {
 *   await Deno.remove("./foo.txt");
 * } catch (error) {
 *   if (!(error instanceof Deno.errors.NotFound)) {
 *     throw error;
 *   }
 *   // Do nothing...
 * }
 * ```
 * @see https://en.wikipedia.org/wiki/Time-of-check_to_time-of-use
 * @deprecated (will be removed after 0.157.0) Checking the state of a file before using it causes a race condition. Perform the actual operation directly instead.
 */
export async function exists(filePath: string | URL): Promise<boolean> {
  try {
    await Deno.lstat(filePath);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    }
    throw error;
  }
}

/**
 * Test whether or not the given path exists by checking with the file system.
 *
 * Note: do not use this function if performing a check before another operation on that file. Doing so creates a race condition. Instead, perform the actual file operation directly.
 *
 * Bad:
 * ```ts
 * import { existsSync } from "https://deno.land/std@$STD_VERSION/fs/mod.ts";
 *
 * if (existsSync("./foo.txt")) {
 *   Deno.removeSync("./foo.txt");
 * }
 * ```
 *
 * Good:
 * ```ts
 * // Notice no use of existsSync
 * try {
 *   Deno.removeSync("./foo.txt");
 * } catch (error) {
 *   if (!(error instanceof Deno.errors.NotFound)) {
 *     throw error;
 *   }
 *   // Do nothing...
 * }
 * ```
 * @see https://en.wikipedia.org/wiki/Time-of-check_to_time-of-use
 * @deprecated (will be removed after 0.157.0) Checking the state of a file before using it causes a race condition. Perform the actual operation directly instead.
 */
export function existsSync(filePath: string | URL): boolean {
  try {
    Deno.lstatSync(filePath);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    }
    throw error;
  }
}
