/*
 * sass.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { existsSync } from "fs/mod.ts";
import { join } from "../deno_ral/path.ts";

import { quartoCacheDir } from "./appdirs.ts";
import { TempContext } from "./temp.ts";

import { SassBundleLayers, SassLayer } from "../config/types.ts";
import { dartCompile } from "./dart-sass.ts";

import * as ld from "./lodash.ts";
import { lines } from "./text.ts";
import { md5Hash } from "./hash.ts";
import { debug } from "../deno_ral/log.ts";
import { safeExistsSync } from "./path.ts";

export interface SassVariable {
  name: string;
  value: unknown;
}

export function sassVariable(
  name: string,
  value: unknown,
  formatter?: (val: unknown) => unknown,
) {
  return {
    name: name,
    value: formatter ? formatter(value) : value,
  };
}

// prints a Sass variable
export function outputVariable(
  variable: SassVariable,
  isDefault = true,
): string {
  return `$${variable.name}: ${variable.value}${isDefault ? " !default" : ""};`;
}

export async function compileSass(
  bundles: SassBundleLayers[],
  temp: TempContext,
  minified = true,
) {
  // Gather the inputs for the framework
  const frameWorkUses = bundles.map(
    (bundle) => bundle.framework?.uses || "",
  );

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
  const quartoUses = bundles.map((bundle) => bundle.quarto?.uses || "");

  const quartoFunctions = bundles.map((bundle) =>
    bundle.quarto?.functions || ""
  );
  const quartoDefaults = bundles.map((bundle) => bundle.quarto?.defaults || "");
  const quartoRules = bundles.map((bundle) => bundle.quarto?.rules || "");

  const quartoMixins = bundles.map((bundle) => bundle.quarto?.mixins || "");

  // Gather sasslayer for the user
  const userUses = bundles.map((bundle) => bundle.user?.uses || "");
  const userFunctions = bundles.map((bundle) => bundle.user?.functions || "");
  const userDefaults = bundles.map((bundle) => bundle.user?.defaults || "");
  const userRules = bundles.map((bundle) => bundle.user?.rules || "");
  const userMixins = bundles.map((bundle) => bundle.user?.mixins || "");

  // Set any load paths used to resolve imports
  const loadPaths: string[] = [];
  bundles.forEach((bundle) => {
    if (bundle.loadPaths) {
      loadPaths.push(...bundle.loadPaths);
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
    ...frameWorkUses,
    ...quartoUses,
    ...userUses,
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
  // Note that you can set this to undefined to bypass the cache entirely
  const cacheKey = bundles.map((bundle) => bundle.key).join("|") + "-" +
    (minified ? "min" : "nomin");

  return await compileWithCache(
    scssInput,
    loadPaths,
    temp,
    minified,
    cacheKey,
  );
}

/*-- scss:uses --*/
/*-- scss:functions --*/
/*-- scss:defaults --*/
/*-- scss:mixins --*/
/*-- scss:rules --*/
const layoutBoundary =
  "^\/\\*\\-\\-[ \\t]*scss:(uses|functions|rules|defaults|mixins)[ \\t]*\\-\\-\\*\\/$";
const kLayerBoundaryLine = RegExp(layoutBoundary);
const kLayerBoundaryTest = RegExp(layoutBoundary, "m");

export function mergeLayers(...layers: SassLayer[]) {
  const themeUses: string[] = [];
  const themeDefaults: string[] = [];
  const themeRules: string[] = [];
  const themeFunctions: string[] = [];
  const themeMixins: string[] = [];
  layers.forEach((theme) => {
    if (theme.uses) {
      themeUses.push(theme.uses);
    }
    if (theme.defaults) {
      // We need to reverse the order of defaults
      // since defaults override one another by being
      // set first
      themeDefaults.unshift(theme.defaults);
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
    uses: themeUses.join("\n"),
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
        uses: "_use.scss",
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

  return sassLayerStr(rawContents, theme);
}

export function sassLayerStr(rawContents: string, errorHint?: string) {
  // Verify that the scss file has required boundaries
  if (!kLayerBoundaryTest.test(rawContents)) {
    throw new Error(
      `The file ${errorHint} doesn't contain at least one layer boundary (/*-- scss:defaults --*/, /*-- scss:rules --*/, /*-- scss:mixins --*/, /*-- scss:functions --*/, or /*-- scss:uses --*/)`,
    );
  }

  const uses: string[] = [];
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
        case "uses":
          accum = uses;
          break;
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
    uses: uses.join("\n"),
    defaults: defaults.join("\n"),
    rules: rules.join("\n"),
    mixins: mixins.join("\n"),
    functions: functions.join("\n"),
  };
}

export function sassLayerDir(
  dir: string,
  names: {
    uses?: string;
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
    uses: read(names.uses),
    defaults: read(names.defaults),
    rules: read(names.rules),
    mixins: read(names.mixins),
    functions: read(names.functions),
  };
}

export async function compileWithCache(
  input: string,
  loadPaths: string[],
  temp: TempContext,
  compressed?: boolean,
  cacheIdentifier?: string,
) {
  if (cacheIdentifier) {
    // Calculate a hash for the input and identifier
    const identifierHash = md5Hash(cacheIdentifier);
    const inputHash = md5Hash(input);

    // If there are imports, the computed input Hash is incorrect
    // so we should be using a session cache which will cache
    // across renders, but not persistently
    const useSessionCache = input.match(/@import/);

    // check the cache
    const cacheDir = useSessionCache
      ? join(temp.baseDir, "sass")
      : quartoCacheDir("sass");
    const cacheIdxPath = join(cacheDir, "index.json");

    const outputFile = `${identifierHash}.css`;
    const outputFilePath = join(cacheDir, outputFile);

    // Check whether we can use a cached file
    let cacheIndex: { [key: string]: { key: string; hash: string } } = {};
    let writeCache = true;
    if (existsSync(outputFilePath)) {
      try {
        cacheIndex = JSON.parse(Deno.readTextFileSync(cacheIdxPath));
        const existingEntry = cacheIndex[identifierHash];
        writeCache = !existingEntry || (existingEntry.hash !== inputHash);
      } catch {
        debug(`The scss cache index file ${cacheIdxPath} can't be read.`);
      }
    }

    // We need to refresh the cache
    if (writeCache) {
      try {
        await dartCompile(
          input,
          outputFilePath,
          temp,
          loadPaths,
          compressed,
        );
      } catch (error) {
        // Compilation failed, so clear out the output file (if exists)
        // which will be invalid CSS
        try {
          if (safeExistsSync(outputFilePath)) {
            Deno.removeSync(outputFilePath);
          }
        } finally {
          //doesn't matter
        }
        throw error;
      }
      cacheIndex[identifierHash] = { key: cacheIdentifier, hash: inputHash };
      Deno.writeTextFileSync(cacheIdxPath, JSON.stringify(cacheIndex));
    }
    return outputFilePath;
  } else {
    const outputFilePath = temp.createFile({ suffix: ".css" });
    // Skip the cache and just compile
    await dartCompile(
      input,
      outputFilePath,
      temp,
      ld.uniq(loadPaths),
      compressed,
    );
    return outputFilePath;
  }
}
