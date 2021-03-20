/*
* dart-sass.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { existsSync } from "fs/mod.ts";
import { join } from "path/mod.ts";
import { createHash } from "hash/mod.ts";

import { binaryPath } from "./resources.ts";
import { execProcess } from "./process.ts";

import { quartoCacheDir } from "../core/appdirs.ts";
import { sessionTempFile } from "./temp.ts";

export async function compileScss(
  input: string,
  loadPaths: string[],
  compressed?: boolean,
  cacheIdentifier?: string,
) {
  if (cacheIdentifier) {
    // Calculate a hash for the input and identifier
    const identifierHash = createHash("md5").update(cacheIdentifier).toString();
    const inputHash = createHash("md5").update(input).toString();

    // check the cache
    const cacheDir = quartoCacheDir("input");
    const cacheIdxPath = join(cacheDir, "index.json");
    const compiledCssPath = join(cacheDir, `${identifierHash}.css`);
    console.log(compiledCssPath);

    // Check whether we can use a cached file
    let cacheIndex: { [key: string]: string } = {};
    let writeCache = true;
    if (existsSync(compiledCssPath)) {
      cacheIndex = JSON.parse(Deno.readTextFileSync(cacheIdxPath));
      const existingHash = cacheIndex[identifierHash];
      writeCache = existingHash !== inputHash;
    }

    // We need to refresh the cache
    if (writeCache) {
      const cssOutput = await dartCompile(input, loadPaths, compressed);
      if (cssOutput) {
        Deno.writeTextFileSync(compiledCssPath, cssOutput || "");
      }
      cacheIndex[identifierHash] = inputHash;
      Deno.writeTextFileSync(cacheIdxPath, JSON.stringify(cacheIndex));
    }
    return compiledCssPath;
  } else {
    // Skip the cache and just compile
    const outputPath = sessionTempFile({ suffix: ".css" });
    const cssOutput = await dartCompile(input, loadPaths, compressed);
    Deno.writeTextFileSync(outputPath, cssOutput || "");
    return outputPath;
  }
}

export async function dartSassInstallDir() {
  return await binaryPath("dart-sass");
}

export async function dartSassVersion() {
  return await dartCommand(["--version"]);
}

async function dartCompile(
  input: string,
  loadPaths?: string[],
  compressed?: boolean,
): Promise<string | undefined> {
  const command = Deno.build.os === "windows" ? "sass.bat" : "sass";
  const sass = binaryPath(join("dart-sass", command));
  const args = [
    "--stdin",
    "--style",
    compressed ? "compressed" : "expanded",
  ];

  if (loadPaths) {
    loadPaths.forEach((loadPath) => {
      args.push(`--load-path=${loadPath}`);
    });
  }

  return await dartCommand(args, input);
}

async function dartCommand(args: string[], stdin?: string) {
  const command = Deno.build.os === "windows" ? "sass.bat" : "sass";
  const sass = binaryPath(join("dart-sass", command));
  const cmd = [
    sass,
    ...args,
  ];

  // Run the sas compiler
  const result = await execProcess(
    {
      cmd,
      stdout: "piped",
    },
    stdin,
  );

  if (result.success) {
    return result.stdout;
  } else {
    throw new Error("Sass command failed");
  }
}
