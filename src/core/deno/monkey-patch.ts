/*
 * monkey-patch.ts
 *
 * Copyright (C) 2022-2023 Posit Software, PBC
 */

import { debug } from "log/mod.ts";
import { normalizePath } from "../path.ts";

// Window UNC paths can be mishandled by realPathSync
// (see https://github.com/quarto-dev/quarto-vscode/issues/67)
// so we monkey-patch to implement the absolute path and normalize
// parts of realPathSync (we aren't interested in the symlink
// resolution, and certainly not on windows that has no symlinks!)
Deno.realPathSync = normalizePath;

// 2023-02-14: We're seeing a rare failure in Deno.makeTempFile{,Sync} with FileExists, so we're going to try
// a few times to create the file. If it fails, we'll log the error and try again.
// If it fails 5 times, we'll throw the error.
// https://github.com/denoland/deno/issues/17781

const maxAttempts = 5;

function withAttempts<T>(callable: () => T) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return callable();
    } catch (err) {
      if (err.message) {
        debug("Error attempting to create temp file: " + err.message);
        if (i === maxAttempts - 1) {
          throw err;
        } else {
          debug(`Retrying... ${i + 1} of ${maxAttempts - 1}`);
        }
      }
    }
  }
  throw new Error("Shouldn't get here");
}

function withAttemptsAsync<T>(callable: () => Promise<T>) {
  const inner = (attempt: number): Promise<T> => {
    return callable().catch((err) => {
      if (err.message) {
        debug("Error attempting to create temp file: " + err.message);
      }
      if (attempt === maxAttempts - 1) {
        throw err;
      } else {
        debug(`Retrying... ${attempt + 1} of ${maxAttempts - 1}`);
        return inner(attempt + 1);
      }
    });
  };
  return inner(0);
}

const oldMakeTempFile: typeof Deno.makeTempFile = Deno.makeTempFile;
const oldMakeTempFileSync: typeof Deno.makeTempFileSync = Deno.makeTempFileSync;
const oldMakeTempDir: typeof Deno.makeTempDir = Deno.makeTempDir;
const oldMakeTempDirSync: typeof Deno.makeTempDirSync = Deno.makeTempDirSync;

function makeTempFileSync(options?: Deno.MakeTempOptions) {
  return withAttempts(() => oldMakeTempFileSync(options));
}
function makeTempFile(options?: Deno.MakeTempOptions) {
  return withAttemptsAsync(() => oldMakeTempFile(options));
}
function makeTempDirSync(options?: Deno.MakeTempOptions) {
  return withAttempts(() => oldMakeTempDirSync(options));
}
function makeTempDir(options?: Deno.MakeTempOptions) {
  return withAttemptsAsync(() => oldMakeTempDir(options));
}

Deno.makeTempFile = makeTempFile;
Deno.makeTempFileSync = makeTempFileSync;
Deno.makeTempDir = makeTempDir;
Deno.makeTempDirSync = makeTempDirSync;

const oldReadTextFile: typeof Deno.readTextFile = Deno.readTextFile;
const oldReadTextFileSync: typeof Deno.readTextFileSync = Deno.readTextFileSync;

Deno.readTextFile = async (
  path: string | URL,
  options?: Deno.ReadFileOptions,
) => {
  try {
    const result = await oldReadTextFile(path, options);
    return result;
  } catch (err) {
    if (err.message) {
      err.message = err.message + "\n" + "Path: " + path;
    }
    throw err;
  }
};

Deno.readTextFileSync = (path: string | URL) => {
  try {
    const result = oldReadTextFileSync(path);
    return result;
  } catch (err) {
    if (err.message) {
      err.message = err.message + "\n" + "Path: " + path;
    }
    throw err;
  }
};
