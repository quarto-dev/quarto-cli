// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { Encodings } from "../_utils.ts";
import { fromFileUrl } from "../path.ts";
import { Buffer } from "../buffer.ts";
import { writeAllSync } from "../../streams/conversion.ts";
import {
  CallbackWithError,
  checkEncoding,
  getEncoding,
  getOpenOptions,
  isFileOptions,
  WriteFileOptions,
} from "./_fs_common.ts";
import { isWindows } from "../../_util/os.ts";
import { AbortError, denoErrorToNodeError } from "../internal/errors.ts";
import {
  showStringCoercionDeprecation,
  validateStringAfterArrayBufferView,
} from "../internal/fs/utils.mjs";
import { promisify } from "../internal/util.mjs";

export function writeFile(
  pathOrRid: string | number | URL,
  // deno-lint-ignore ban-types
  data: string | Uint8Array | Object,
  optOrCallback: Encodings | CallbackWithError | WriteFileOptions | undefined,
  callback?: CallbackWithError,
) {
  const callbackFn: CallbackWithError | undefined =
    optOrCallback instanceof Function ? optOrCallback : callback;
  const options: Encodings | WriteFileOptions | undefined =
    optOrCallback instanceof Function ? undefined : optOrCallback;

  if (!callbackFn) {
    throw new TypeError("Callback must be a function.");
  }

  pathOrRid = pathOrRid instanceof URL ? fromFileUrl(pathOrRid) : pathOrRid;

  const flag: string | undefined = isFileOptions(options)
    ? options.flag
    : undefined;

  const mode: number | undefined = isFileOptions(options)
    ? options.mode
    : undefined;

  const encoding = checkEncoding(getEncoding(options)) || "utf8";
  const openOptions = getOpenOptions(flag || "w");

  if (!ArrayBuffer.isView(data)) {
    validateStringAfterArrayBufferView(data, "data");
    if (typeof data !== "string") {
      showStringCoercionDeprecation();
    }
    data = Buffer.from(String(data), encoding);
  }

  const isRid = typeof pathOrRid === "number";
  let file;

  let error: Error | null = null;
  (async () => {
    try {
      file = isRid
        ? new Deno.FsFile(pathOrRid as number)
        : await Deno.open(pathOrRid as string, openOptions);

      // ignore mode because it's not supported on windows
      // TODO: remove `!isWindows` when `Deno.chmod` is supported
      if (!isRid && mode && !isWindows) {
        await Deno.chmod(pathOrRid as string, mode);
      }

      const signal: AbortSignal | undefined = isFileOptions(options)
        ? options.signal
        : undefined;
      await writeAll(file, data as Uint8Array, { signal });
    } catch (e) {
      error = e instanceof Error
        ? denoErrorToNodeError(e, { syscall: "write" })
        : new Error("[non-error thrown]");
    } finally {
      // Make sure to close resource
      if (!isRid && file) file.close();
      callbackFn(error);
    }
  })();
}

export const writeFilePromise = promisify(writeFile) as (
  pathOrRid: string | number | URL,
  // deno-lint-ignore ban-types
  data: string | Uint8Array | Object,
  options?: Encodings | WriteFileOptions,
) => Promise<void>;

export function writeFileSync(
  pathOrRid: string | number | URL,
  // deno-lint-ignore ban-types
  data: string | Uint8Array | Object,
  options?: Encodings | WriteFileOptions,
) {
  pathOrRid = pathOrRid instanceof URL ? fromFileUrl(pathOrRid) : pathOrRid;

  const flag: string | undefined = isFileOptions(options)
    ? options.flag
    : undefined;

  const mode: number | undefined = isFileOptions(options)
    ? options.mode
    : undefined;

  const encoding = checkEncoding(getEncoding(options)) || "utf8";
  const openOptions = getOpenOptions(flag || "w");

  if (!ArrayBuffer.isView(data)) {
    validateStringAfterArrayBufferView(data, "data");
    if (typeof data !== "string") {
      showStringCoercionDeprecation();
    }
    data = Buffer.from(String(data), encoding);
  }

  const isRid = typeof pathOrRid === "number";
  let file;

  let error: Error | null = null;
  try {
    file = isRid
      ? new Deno.FsFile(pathOrRid as number)
      : Deno.openSync(pathOrRid as string, openOptions);

    // ignore mode because it's not supported on windows
    // TODO: remove `!isWindows` when `Deno.chmod` is supported
    if (!isRid && mode && !isWindows) {
      Deno.chmodSync(pathOrRid as string, mode);
    }

    writeAllSync(file, data as Uint8Array);
  } catch (e) {
    error = e instanceof Error
      ? denoErrorToNodeError(e, { syscall: "write" })
      : new Error("[non-error thrown]");
  } finally {
    // Make sure to close resource
    if (!isRid && file) file.close();
  }

  if (error) throw error;
}

interface WriteAllOptions {
  offset?: number;
  length?: number;
  signal?: AbortSignal;
}
async function writeAll(
  w: Deno.Writer,
  arr: Uint8Array,
  options: WriteAllOptions = {},
) {
  const { offset = 0, length = arr.byteLength, signal } = options;
  checkAborted(signal);

  const written = await w.write(arr.subarray(offset, offset + length));

  if (written === length) {
    return;
  }

  await writeAll(w, arr, {
    offset: offset + written,
    length: length - written,
    signal,
  });
}

function checkAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new AbortError();
  }
}
