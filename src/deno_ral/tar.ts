/*
 * tar.ts
 *
 * Copyright (C) 2025 Posit Software, PBC
 *
 * Abstraction layer over Deno's `tar` utilities.
 */

import { TarStream, type TarStreamInput } from "jsr:@std/tar/tar-stream";

/**
 * Creates a tar archive from the specified files and directories.
 * @param outputPath The path where the tar archive will be created.
 * @param filePaths An array of file and directory paths to include in the tar archive. Paths are relative to outputPath.
 * @returns A promise that resolves when the tar archive is created.
 */
export async function createTarFromFiles(
  outputPath: string,
  filePaths: string[],
) {
  // Create array of TarStreamInput objects from file paths
  const inputs: TarStreamInput[] = await Promise.all(
    filePaths.map(async (path) => {
      const stat = await Deno.stat(path);

      if (stat.isDirectory) {
        // Handle directory
        return {
          type: "directory",
          path: path + (path.endsWith("/") ? "" : "/"),
        };
      } else {
        // Handle file
        return {
          type: "file",
          path: path,
          size: stat.size,
          readable: (await Deno.open(path)).readable,
        };
      }
    }),
  );

  // Create tar file using streaming API
  await ReadableStream.from(inputs)
    .pipeThrough(new TarStream())
    .pipeTo((await Deno.create(outputPath)).writable);
}
