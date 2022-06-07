// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
/**
 * Test whether or not the given path exists by checking with the file system
 * @deprecated Checking the state of a file before using it causes a race condition. Perform the actual operation directly instead.
 * @see https://en.wikipedia.org/wiki/Time-of-check_to_time-of-use
 */
export async function exists(filePath: string): Promise<boolean> {
  try {
    await Deno.lstat(filePath);
    return true;
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      return false;
    }

    throw err;
  }
}

/**
 * Test whether or not the given path exists by checking with the file system
 * @deprecated Checking the state of a file before using it causes a race condition. Perform the actual operation directly instead.
 * @see https://en.wikipedia.org/wiki/Time-of-check_to_time-of-use
 */
export function existsSync(filePath: string): boolean {
  try {
    Deno.lstatSync(filePath);
    return true;
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      return false;
    }
    throw err;
  }
}
