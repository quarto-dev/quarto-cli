import { writeAll } from "io/write-all";
import { ensureDirSync } from "../../../src/deno_ral/fs.ts";
import { unzip as coreUnzip } from "../../../src/core/zip.ts";

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

export async function download(src: string, dest: string): Promise<void> {
  const response = await fetch(src);
  const data = await response.blob();

  const buffer = await data.arrayBuffer();
  const contents = new Uint8Array(buffer);

  const file = await Deno.create(dest);
  await writeAll(file, contents);
  file.close();
}

// Expand-Archive is avoided: Windows PowerShell 5.1 can load PowerShell 7's
// Archive module from an inherited PSModulePath, fail, and still exit 0.
export async function unzip(zipFile: string, dest: string): Promise<void> {
  // the core helper runs unzip with dest as cwd on Linux/macOS
  ensureDirSync(dest);
  const result = await coreUnzip(zipFile, dest);
  if (!result.success) {
    throw new Error(
      `Failed to extract ${zipFile} to ${dest}:\n${result.stderr ?? ""}`,
    );
  }
}
