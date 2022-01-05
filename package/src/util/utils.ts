import { ensureDir } from "fs/mod.ts";
import { dirname } from "path/mod.ts";
import { CmdResult, runCmd } from "./cmd.ts";
import {
  writableStreamFromWriter,
  WritableStreamFromWriterOptions,
} from "streams/conversion.ts";
// Read an environment variable
export function getEnv(name: string, defaultValue?: string) {
  const value = Deno.env.get(name);
  if (!value) {
    if (defaultValue === undefined) {
      throw new Error("Missing environment variable: " + name);
    } else {
      return defaultValue;
    }
  } else {
    return value;
  }
}

/**
 * download from a url-like src to a writer
 * @param src source to download from
 * @param dest writer to write output to
 * @param [respValidatorFunc] validator func to invoke on response object
 * the validator should throw if there is an issue, and the download function
 * will properly clean up resources
 * @param [wopts] writableStream opts (namely to control if want to not autoClose after writing)
 * @example
 * const file = await Deno.open("some/file.ext", { write: true, create: true });
 * await download("https://dl.com/file", file)
 *
 * // or to make sure its a file, could check that the content-type is
 * // application/octet-stream
 * await download("https://dl.com/file", file, (resp) => {
 *   if (response.headers.get("content-type") != "application/octet-stream") {
 *      throw(new Error("download url does not seem to provide a file"))
 *   }
 * })
 */
export async function download(
  src: string | URL | Request,
  dest: Deno.Writer,
  respValidatorFunc?: (response: Response) => void,
  wopts?: WritableStreamFromWriterOptions,
): Promise<void> {
  const response = await fetch(src);
  const ws = writableStreamFromWriter(dest, wopts);

  if (!response.ok) {
    // need to be sure to close the body stream and writer (optionally) or can leak resources
    await ws.abort();
    await response.body?.cancel();
    throw new Error("unable to download from: " + src);
  }
  if (respValidatorFunc) {
    // this needs to be wrapped in a tryCatch to rethrow any errors
    // else if it goes to throw an error and the user doesn't manually
    // close the response body will leak resources
    // this will show up in a tests where deno will detect with
    // a note that fetchResponseBody isn't closed
    try {
      respValidatorFunc(response);
    } catch (err) {
      await ws.abort();
      await response.body?.cancel();
      throw err;
    }
  }
  // this will automatically close the dest writer if autoClose is
  // set to true for the writableStream options
  await response.body?.pipeTo(
    ws,
  );
}

/**
 * Download a file. Before downloading, recursively create any directories needed
 * so the file can be created
 * @param src source target
 * @param dest path on file system to download
 */
export async function downloadFile(src: string | URL | Request, dest: string) {
  const validContentTypes = [
    // github release tarballs are also application/octet-stream
    "application/octet-stream",
    // https://www.rfc-editor.org/rfc/rfc6713
    "application/gzip",
    // https://superuser.com/questions/901962/what-is-the-correct-mime-type-for-a-tar-gz-file
    // github zips are application/zip
    "application/zip",
  ];
  await ensureDir(dirname(dest));
  const destFile = await Deno.create(dest);
  await download(src, destFile, (resp) => {
    const ct = resp.headers.get("content-type");
    if (!ct || !validContentTypes.includes(ct)) {
      throw (new Error(
        "content-type not valid, must be one of: " +
          validContentTypes.join(", "),
      ));
    }
  });
}

export async function unzip(
  zipFile: string,
  dest: string,
): Promise<CmdResult> {
  if (Deno.build.os === "windows") {
    return await runCmd("PowerShell", [
      "Expand-Archive",
      "-Path",
      zipFile,
      "-DestinationPath",
      dest,
    ]);
  } else {
    return await runCmd("unzip", [zipFile, "-d", dest]);
  }
}
