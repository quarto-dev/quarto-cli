/*
 * bundle.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { dirname, join } from "path/mod.ts";
import { copy } from "streams/copy.ts";
import { ensureDirSync } from "fs/mod.ts";

import { Tar } from "archive/tar.ts";

import { PublishFiles } from "../provider-types.ts";
import { TempContext } from "../../core/temp-types.ts";
import { md5HashBytes } from "../../core/hash.ts";

/** Creates a compressed bundle file in the format required by Posit Connect and Cloud.
 * @param type Whether this is a site or document.
 * @param files Information on what should be included in the bundle.
 * @param tempContext Temporary directory where file operations will be performed.
 * @returns The absolute path of the bundle file.
 */
export async function createBundle(
  type: "site" | "document",
  files: PublishFiles,
  tempContext: TempContext,
): Promise<string> {
  // create file md5 checksums
  const manifestFiles: Record<string, { checksum: string }> = {};
  for (const file of files.files) {
    const filePath = join(files.baseDir, file);
    if (Deno.statSync(filePath).isFile) {
      const fileBytes = Deno.readFileSync(filePath);
      const checksum = md5HashBytes(fileBytes);
      manifestFiles[file] = { checksum };
    }
  }

  // create manifest
  const manifest = {
    version: 1,
    locale: "en_US",
    platform: "4.2.0",
    metadata: {
      appmode: "static",
      primary_rmd: null,
      primary_html: files.rootFile,
      content_category: type === "site" ? "site" : null,
      has_parameters: false,
    },
    packages: null,
    files: manifestFiles,
    users: null,
  };

  // stage files into temp dir
  const stageDir = tempContext.createDir();
  files.files.forEach((file) => {
    const filePath = join(files.baseDir, file);
    if (Deno.statSync(filePath).isFile) {
      const targetDir = join(stageDir, dirname(file));
      ensureDirSync(targetDir);
      Deno.copyFileSync(filePath, join(stageDir, file));
    }
  });
  // write manifest
  Deno.writeTextFileSync(
    join(stageDir, "manifest.json"),
    JSON.stringify(manifest, undefined, 2),
  );

  // create tar
  const tar = new Tar();
  const tarFiles = [...files.files, "manifest.json"];

  for (const tarFile of tarFiles) {
    await tar.append(tarFile, { filePath: join(stageDir, tarFile) });
  }

  // write to temp file
  const tarFile = tempContext.createFile({ suffix: ".tar" });
  const writer = Deno.openSync(tarFile, { write: true, create: true });
  await copy(tar.getReader(), writer);
  writer.close();

  // compress to tar.gz
  const targzFile = `${tarFile}.gz`;
  const src = await Deno.open(tarFile);
  const dest = await Deno.open(targzFile, {
    create: true,
    write: true,
  });
  await src.readable
    .pipeThrough(new CompressionStream("gzip"))
    .pipeTo(dest.writable);

  // return tar.gz
  return targzFile;
}
