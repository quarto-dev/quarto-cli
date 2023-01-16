// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import {
  emitRecursiveRmdirWarning,
  getValidatedPath,
  validateRmdirOptions,
  validateRmOptions,
  validateRmOptionsSync,
} from "../internal/fs/utils.mjs";
import { toNamespacedPath } from "../path.ts";
import {
  denoErrorToNodeError,
  ERR_FS_RMDIR_ENOTDIR,
} from "../internal/errors.ts";
import { Buffer } from "../buffer.ts";
import { promisify } from "../internal/util.mjs";

type rmdirOptions = {
  maxRetries?: number;
  recursive?: boolean;
  retryDelay?: number;
};

type rmdirCallback = (err?: Error) => void;

export function rmdir(path: string | URL, callback: rmdirCallback): void;
export function rmdir(
  path: string | URL,
  options: rmdirOptions,
  callback: rmdirCallback,
): void;
export function rmdir(
  path: string | URL,
  optionsOrCallback: rmdirOptions | rmdirCallback,
  maybeCallback?: rmdirCallback,
) {
  path = toNamespacedPath(getValidatedPath(path) as string);

  const callback = typeof optionsOrCallback === "function"
    ? optionsOrCallback
    : maybeCallback;
  const options = typeof optionsOrCallback === "object"
    ? optionsOrCallback
    : undefined;

  if (!callback) throw new Error("No callback function supplied");

  if (options?.recursive) {
    emitRecursiveRmdirWarning();
    validateRmOptions(
      path,
      { ...options, force: false },
      true,
      (err: Error | null | false, options: rmdirOptions) => {
        if (err === false) {
          return callback(new ERR_FS_RMDIR_ENOTDIR(path.toString()));
        }
        if (err) {
          return callback(err);
        }

        Deno.remove(path, { recursive: options?.recursive })
          .then((_) => callback(), callback);
      },
    );
  } else {
    validateRmdirOptions(options);
    Deno.remove(path, { recursive: options?.recursive })
      .then((_) => callback(), (err: unknown) => {
        callback(
          err instanceof Error
            ? denoErrorToNodeError(err, { syscall: "rmdir" })
            : err,
        );
      });
  }
}

export const rmdirPromise = promisify(rmdir) as (
  path: string | Buffer | URL,
  options?: rmdirOptions,
) => Promise<void>;

export function rmdirSync(path: string | Buffer | URL, options?: rmdirOptions) {
  path = getValidatedPath(path);
  if (options?.recursive) {
    emitRecursiveRmdirWarning();
    options = validateRmOptionsSync(path, { ...options, force: false }, true);
    if (options === false) {
      throw new ERR_FS_RMDIR_ENOTDIR(path.toString());
    }
  } else {
    validateRmdirOptions(options);
  }

  try {
    Deno.removeSync(toNamespacedPath(path as string), {
      recursive: options?.recursive,
    });
  } catch (err: unknown) {
    throw (err instanceof Error
      ? denoErrorToNodeError(err, { syscall: "rmdir" })
      : err);
  }
}
