/*
 * temp.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Temporary files and directories. Carries the retry that
 * core/deno/monkey-patch.ts installs on Deno.makeTemp* (rare EEXIST races,
 * https://github.com/denoland/deno/issues/17781), narrowed to AlreadyExists:
 * any other error (a missing parent directory, a permission problem) is
 * reported at once. The monkey patch's own loop runs inside this one; that is
 * harmless.
 */

import { isAlreadyExists } from "./errors.ts";
import { debug } from "./log.ts";

export interface TempOptions {
  dir?: string;
  prefix?: string;
  suffix?: string;
}

const kMaxAttempts = 5;

/** Call fn up to `attempts` times while it throws an AlreadyExists error. */
export function retryOnAlreadyExists<T>(
  fn: () => T,
  attempts = kMaxAttempts,
): T {
  for (let i = 1; ; i++) {
    try {
      return fn();
    } catch (err) {
      if (!isAlreadyExists(err) || i >= attempts) {
        throw err;
      }
      debug(`Temp path already exists, retrying (${i} of ${attempts - 1})`);
    }
  }
}

async function retryOnAlreadyExistsAsync<T>(
  fn: () => Promise<T>,
  attempts = kMaxAttempts,
): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (!isAlreadyExists(err) || i >= attempts) {
        throw err;
      }
      debug(`Temp path already exists, retrying (${i} of ${attempts - 1})`);
    }
  }
}

export function makeTempDirSync(options?: TempOptions): string {
  return retryOnAlreadyExists(() => Deno.makeTempDirSync(options));
}

export function makeTempDir(options?: TempOptions): Promise<string> {
  return retryOnAlreadyExistsAsync(() => Deno.makeTempDir(options));
}

export function makeTempFileSync(options?: TempOptions): string {
  return retryOnAlreadyExists(() => Deno.makeTempFileSync(options));
}

export function makeTempFile(options?: TempOptions): Promise<string> {
  return retryOnAlreadyExistsAsync(() => Deno.makeTempFile(options));
}
