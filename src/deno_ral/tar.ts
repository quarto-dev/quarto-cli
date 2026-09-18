/*
 * tar.ts
 *
 * Copyright (C) 2025 Posit Software, PBC
 *
 * Abstraction layer over Deno's `tar` utilities.
 */

import { TarStream, type TarStreamInput } from "tar/tar-stream";
import { join } from "../deno_ral/path.ts";
import { pathWithForwardSlashes } from "../core/path.ts";

/**
 * Creates a tar archive from the specified files and directories.
 * @param outputPath The path where the tar archive will be created.
 * @param filePaths An array of file and directory paths to include in the tar archive.
 * @param options Optional configuration for tar creation.
 * @param options.baseDir Base directory for resolving relative paths in the archive.
 * @returns A promise that resolves when the tar archive is created.
 */
export async function createTarFromFiles(
  outputPath: string,
  filePaths: string[],
  options?: { baseDir?: string },
) {
  const baseDir = options?.baseDir;

  // Create array of TarStreamInput objects from file paths
  const inputs: TarStreamInput[] = await Promise.all(
    filePaths.map(async (path) => {
      const fullPath = baseDir ? join(baseDir, path) : path;
      const stat = await Deno.stat(fullPath);

      // Use original path for archive, full path for reading
      const archivePath = pathWithForwardSlashes(path);

      if (stat.isDirectory) {
        // Handle directory
        return {
          type: "directory",
          path: archivePath + (archivePath.endsWith("/") ? "" : "/"),
        };
      } else {
        // Handle file
        return {
          type: "file",
          path: archivePath,
          size: stat.size,
          readable: (await Deno.open(fullPath)).readable,
        };
      }
    }),
  );

  // Create tar file using streaming API
  await ReadableStream.from(inputs)
    .pipeThrough(new TarStream())
    .pipeTo((await Deno.create(outputPath)).writable);
}
