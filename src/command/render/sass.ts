/*
* sass.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { existsSync } from "fs/mod.ts";
import { join } from "path/mod.ts";
import { createHash } from "hash/mod.ts";

import { quartoCacheDir } from "../../core/appdirs.ts";
import { sessionTempFile } from "../../core/temp.ts";

import { SassBundle } from "../../config/format.ts";
import { dartCompile } from "../../core/dart-sass.ts";

export async function compileSass(bundles: SassBundle[]) {
  // Gather the inputs for the framework
  const frameworkDeclarations = bundles.map(
    (bundle) => bundle.framework?.declarations || "",
  );

  const frameworkVariables = bundles.map((bundle) =>
    bundle.framework?.variables || ""
  );

  const frameworkRules = bundles.map(
    (bundle) => bundle.framework?.rules || "",
  );

  // Gather inputs for the
  const layerDeclarations = bundles.map((bundle) => bundle.layer.declarations);
  const layerVariables = bundles.map((bundle) => bundle.layer.variables);
  const layerRules = bundles.map((bundle) => bundle.layer.rules);

  // Set any load paths used to resolve imports
  const loadPaths: string[] = [];
  bundles.forEach((bundle) => {
    if (bundle.loadPath) {
      loadPaths.push(bundle.loadPath);
    }
  });

  // Read the scss files into a single input string
  // * Declarations are available to variables and rules
  //   (framework declarations are first to make them acessible to all)
  // * Variables are applied in reverse order
  //   (first variable generally takes precedence in sass assuming use of !default)
  // * Rules may use variables and declarations
  //   (theme follows framework so it can override the framework rules)
  const scssInput = [
    ...frameworkDeclarations,
    ...layerDeclarations,
    ...layerVariables.reverse(),
    ...frameworkVariables.reverse(),
    ...frameworkRules,
    ...layerRules,
  ].join("\n\n");

  // Compile the scss
  return await compileWithCache(
    scssInput,
    loadPaths,
    true,
    bundles.map((bundle) => bundle.key).join("|"),
  );
}

async function compileWithCache(
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
    const cacheDir = quartoCacheDir("sass");
    console.log(cacheDir);
    const cacheIdxPath = join(cacheDir, "index.json");

    const outputFile = `${identifierHash}.css`;
    const outputFilePath = join(cacheDir, outputFile);

    // Check whether we can use a cached file
    let cacheIndex: { [key: string]: { key: string; hash: string } } = {};
    let writeCache = true;
    if (existsSync(outputFilePath)) {
      cacheIndex = JSON.parse(Deno.readTextFileSync(cacheIdxPath));
      const existingEntry = cacheIndex[identifierHash];
      writeCache = existingEntry.hash !== inputHash;
    }

    // We need to refresh the cache
    if (writeCache) {
      const cssOutput = await dartCompile(input, loadPaths, compressed);
      if (cssOutput) {
        Deno.writeTextFileSync(outputFilePath, cssOutput || "");
      }
      cacheIndex[identifierHash] = { key: cacheIdentifier, hash: inputHash };
      Deno.writeTextFileSync(cacheIdxPath, JSON.stringify(cacheIndex));
    }
    return outputFilePath;
  } else {
    const outputFilePath = sessionTempFile({ suffix: "css" });
    // Skip the cache and just compile
    const cssOutput = await dartCompile(input, loadPaths, compressed);
    Deno.writeTextFileSync(outputFilePath, cssOutput || "");
    return outputFilePath;
  }
}
