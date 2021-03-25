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
  // bootstrapDeclarations are available to variables and rules
  const bootstrapDeclarations = bundles.filter((bundle) =>
    bundle.bootstrap?.declarations.length
  )
    .map(
      (bundle) => bundle.bootstrap?.declarations,
    );

  // quarto declarations follow bootstrap declarations so bootstrap functions are available to all
  const quartoDeclarations = bundles.filter((bundle) =>
    bundle.quarto.declarations.length
  ).map((bundle) => bundle.quarto.declarations);

  // Variables are applied in reverse order (bottom to top as we are expecting)
  // scss files to the !default notation to allow earlier files to set values
  const boostrapVariables = bundles.filter((bundle) =>
    bundle.bootstrap?.variables.length
  ).map(
    (bundle) => bundle.bootstrap?.variables,
  ).reverse();

  const quartoVariables = bundles.filter((bundle) =>
    bundle.quarto.variables.length
  )
    .map(
      (bundle) => bundle.quarto.variables,
    ).reverse();

  // rules may use variables and bootstrapDeclarations
  const bootstrapRules = bundles.filter((bundle) =>
    bundle.bootstrap?.rules.length
  )
    .map(
      (bundle) => bundle.bootstrap?.rules,
    );
  const quartoRules = bundles.filter((bundle) => bundle.quarto.rules.length)
    .map(
      (bundle) => bundle.quarto.rules,
    );

  // Set any load paths used to resolve imports
  const loadPaths: string[] = [];
  bundles.forEach((bundle) => {
    if (bundle.loadPath) {
      loadPaths.push(bundle.loadPath);
    }
  });

  // Read the scss files into a single input string
  const scssInput = [
    ...bootstrapDeclarations,
    ...quartoDeclarations,
    ...quartoVariables,
    ...boostrapVariables,
    ...bootstrapRules,
    ...quartoRules,
  ].join("\n\n");

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
