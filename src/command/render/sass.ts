/*
* sass.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { ensureDirSync, existsSync } from "fs/mod.ts";
import { join } from "path/mod.ts";
import { createHash } from "hash/mod.ts";

import { quartoCacheDir } from "../../core/appdirs.ts";
import { sessionTempDir } from "../../core/temp.ts";

import { SassBundle } from "../../config/format.ts";
import { dartCompile } from "../../core/dart-sass.ts";

export async function compileSass(bundles: SassBundle[], output: string) {
  const variables = bundles.filter((bundle) => bundle.variables.length).map(
    (bundle) => bundle.variables,
  ).reverse();

  const declarations = bundles.filter((bundle) => bundle.declarations.length)
    .map(
      (bundle) => bundle.declarations,
    );
  const rules = bundles.filter((bundle) => bundle.rules.length)
    .map(
      (bundle) => bundle.rules,
    );

  const loadPaths: string[] = [];
  bundles.forEach((bundle) => {
    if (bundle.loadPath) {
      loadPaths.push(bundle.loadPath);
    }
  });

  // Read the scss files into a single input string
  const scssInput = [...declarations, ...variables, ...rules].join("\n\n");

  // Compile the scss
  return await compileWithCache(
    scssInput,
    output,
    loadPaths,
    true,
    bundles.map((bundle) => bundle.key).join("|"),
  );
}

async function compileWithCache(
  input: string,
  output: string,
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
    const outputDirectory = join(cacheDir, identifierHash);
    const outputFilePath = join(outputDirectory, output);

    // Make sure the output directory exists
    ensureDirSync(outputDirectory);

    // Check whether we can use a cached file
    let cacheIndex: { [key: string]: string } = {};
    let writeCache = true;
    if (existsSync(outputFilePath)) {
      cacheIndex = JSON.parse(Deno.readTextFileSync(cacheIdxPath));
      const existingHash = cacheIndex[identifierHash];
      writeCache = existingHash !== inputHash;
    }

    // We need to refresh the cache
    if (writeCache) {
      const cssOutput = await dartCompile(input, loadPaths, compressed);
      if (cssOutput) {
        Deno.writeTextFileSync(outputFilePath, cssOutput || "");
      }
      cacheIndex[identifierHash] = inputHash;
      Deno.writeTextFileSync(cacheIdxPath, JSON.stringify(cacheIndex));
    }
    return outputFilePath;
  } else {
    const outputDir = sessionTempDir();
    const outputFilePath = join(outputDir, output);
    // Skip the cache and just compile
    const cssOutput = await dartCompile(input, loadPaths, compressed);
    Deno.writeTextFileSync(outputFilePath, cssOutput || "");
    return outputFilePath;
  }
}
