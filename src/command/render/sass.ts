/*
* sass.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { existsSync } from "fs/mod.ts";
import { join } from "path/mod.ts";

import { quartoCacheDir } from "../../core/appdirs.ts";
import { sessionTempFile } from "../../core/temp.ts";

import { SassBundle, SassLayer } from "../../config/types.ts";
import { dartCompile } from "../../core/dart-sass.ts";

import { ld } from "lodash/mod.ts";
import { lines } from "../../core/text.ts";
import { md5Hash } from "../../core/hash.ts";

export async function compileSass(bundles: SassBundle[], minified = true) {
  const imports = ld.uniq(bundles.flatMap((bundle) => {
    return [
      ...(bundle.user?.use || []),
      ...(bundle.quarto?.use || []),
      ...(bundle.framework?.use || []),
    ];
  }));
  const useStatements = imports.map((use) => {
    return `@use '${use}';`;
  }).join("\n");

  // Gather the inputs for the framework
  const frameworkFunctions = bundles.map(
    (bundle) => bundle.framework?.functions || "",
  );

  const frameworkDefaults = bundles.map((bundle) =>
    bundle.framework?.defaults || ""
  );

  const frameworkRules = bundles.map(
    (bundle) => bundle.framework?.rules || "",
  );

  const frameworkMixins = bundles.map(
    (bundle) => bundle.framework?.mixins || "",
  );

  // Gather sasslayer for quarto
  const quartoFunctions = bundles.map((bundle) =>
    bundle.quarto?.functions || ""
  );
  const quartoDefaults = bundles.map((bundle) => bundle.quarto?.defaults || "");
  const quartoRules = bundles.map((bundle) => bundle.quarto?.rules || "");

  const quartoMixins = bundles.map((bundle) => bundle.quarto?.mixins || "");

  // Gather sasslayer for the user
  const userFunctions = bundles.map((bundle) => bundle.user?.functions || "");
  const userDefaults = bundles.map((bundle) => bundle.user?.defaults || "");
  const userRules = bundles.map((bundle) => bundle.user?.rules || "");
  const userMixins = bundles.map((bundle) => bundle.user?.mixins || "");

  // Set any load paths used to resolve imports
  const loadPaths: string[] = [];
  bundles.forEach((bundle) => {
    if (bundle.loadPath) {
      loadPaths.push(bundle.loadPath);
    }
  });

  // Read the scss files into a single input string
  // * Functions are available to variables and rules
  //   (framework functions are first to make them acessible to all)
  // * Variables are applied in reverse order
  //   (first variable generally takes precedence in sass assuming use of !default)
  // * Mixins are available to rules as well
  // * Rules may use functions, variables, and mixins
  //   (theme follows framework so it can override the framework rules)
  const scssInput = [
    useStatements,
    ...frameworkFunctions,
    ...quartoFunctions,
    ...userFunctions,
    ...userDefaults.reverse(),
    ...quartoDefaults.reverse(),
    ...frameworkDefaults.reverse(),
    ...frameworkMixins,
    ...quartoMixins,
    ...userMixins,
    ...frameworkRules,
    ...quartoRules,
    ...userRules,
  ].join("\n\n");

  // Compile the scss
  return await compileWithCache(
    scssInput,
    loadPaths,
    minified,
    bundles.map((bundle) => bundle.key).join("|") + "-" +
      (minified ? "min" : "nomin"),
  );
}

/*-- scss:functions --*/
/*-- scss:defaults --*/
/*-- scss:mixins --*/
/*-- scss:rules --*/
const layoutBoundary =
  "^\/\\*\\-\\-[ \\t]*scss:(functions|rules|defaults|mixins)[ \\t]*\\-\\-\\*\\/$";
const kLayerBoundaryLine = RegExp(layoutBoundary);
const kLayerBoundaryTest = RegExp(layoutBoundary, "m");

export function mergeLayers(...layers: SassLayer[]) {
  const themeDefaults: string[] = [];
  const themeRules: string[] = [];
  const themeFunctions: string[] = [];
  const themeMixins: string[] = [];
  layers.forEach((theme) => {
    if (theme.defaults) {
      themeDefaults.push(theme.defaults);
    }

    if (theme.rules) {
      themeRules.push(theme.rules);
    }

    if (theme.functions) {
      themeFunctions.push(theme.functions);
    }

    if (theme.mixins) {
      themeMixins.push(theme.mixins);
    }
  });

  return {
    defaults: themeDefaults.join("\n"),
    functions: themeFunctions.join("\n"),
    mixins: themeMixins.join("\n"),
    rules: themeRules.join("\n"),
  };
}

export function sassLayer(path: string): SassLayer {
  if (Deno.statSync(path).isFile) {
    return sassLayerFile(path);
  } else {
    return sassLayerDir(
      path,
      {
        functions: "_functions.scss",
        defaults: "_defaults.scss",
        mixins: "_mixins.scss",
        rules: "_rules.scss",
      },
    );
  }
}

export function sassLayerFile(theme: string): SassLayer {
  // It is not a built in theme, so read the theme file and parse it.
  const rawContents = Deno.readTextFileSync(theme);

  // Verify that the scss file has required boundaries
  if (!kLayerBoundaryTest.test(rawContents)) {
    throw new Error(
      `The file ${theme} doesn't contain at least one layer boundaries (/*-- scss:defaults --*/, /*-- scss:rules --*/, /*-- scss:mixins --*/ or /*-- scss:functions --*/)`,
    );
  }

  const defaults: string[] = [];
  const rules: string[] = [];
  const functions: string[] = [];
  const mixins: string[] = [];
  let accum = defaults;
  lines(rawContents).forEach((line) => {
    const scopeMatch = line.match(kLayerBoundaryLine);
    if (scopeMatch) {
      const scope = scopeMatch[1];
      switch (scope) {
        case "defaults":
          accum = defaults;
          break;
        case "rules":
          accum = rules;
          break;
        case "functions":
          accum = functions;
          break;
        case "mixins":
          accum = mixins;
          break;
      }
    } else {
      accum.push(line);
    }
  });

  return {
    defaults: defaults.join("\n"),
    rules: rules.join("\n"),
    mixins: mixins.join("\n"),
    functions: functions.join("\n"),
  };
}

export function sassLayerDir(
  dir: string,
  names: {
    functions?: string;
    defaults?: string;
    mixins?: string;
    rules?: string;
  },
): SassLayer {
  const read = (
    path?: string,
  ) => {
    if (path) {
      path = join(dir, path);
      if (existsSync(path)) {
        return Deno.readTextFileSync(path);
      } else {
        return "";
      }
    } else {
      return "";
    }
  };

  // It's a directory, look for names files instead
  return {
    defaults: read(names.defaults),
    rules: read(names.rules),
    mixins: read(names.mixins),
    functions: read(names.functions),
  };
}

async function compileWithCache(
  input: string,
  loadPaths: string[],
  compressed?: boolean,
  cacheIdentifier?: string,
) {
  if (cacheIdentifier) {
    // Calculate a hash for the input and identifier
    const identifierHash = md5Hash(cacheIdentifier);
    const inputHash = md5Hash(input);

    // check the cache
    const cacheDir = quartoCacheDir("sass");
    const cacheIdxPath = join(cacheDir, "index.json");

    const outputFile = `${identifierHash}.css`;
    const outputFilePath = join(cacheDir, outputFile);

    // Check whether we can use a cached file
    let cacheIndex: { [key: string]: { key: string; hash: string } } = {};
    let writeCache = true;
    if (existsSync(outputFilePath)) {
      cacheIndex = JSON.parse(Deno.readTextFileSync(cacheIdxPath));
      const existingEntry = cacheIndex[identifierHash];
      writeCache = !existingEntry || (existingEntry.hash !== inputHash);
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
