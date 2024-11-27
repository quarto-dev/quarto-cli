/*
 * sass.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { existsSync } from "../deno_ral/fs.ts";
import { join } from "../deno_ral/path.ts";

import { quartoCacheDir } from "./appdirs.ts";
import { TempContext } from "./temp.ts";

import { SassBundleLayers, SassLayer } from "../config/types.ts";
import { dartCompile } from "./dart-sass.ts";

import * as ld from "./lodash.ts";
import { lines } from "./text.ts";
import { sassCache } from "./sass/cache.ts";
import { cssVarsBlock } from "./sass/add-css-vars.ts";
import { md5HashBytes } from "./hash.ts";
import { kSourceMappingRegexes } from "../config/constants.ts";
import { quartoConfig } from "../core/quarto.ts";
import { safeModeFromFile } from "../deno_ral/fs.ts";

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

let counter: number = 1;
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

  const userLayers = mergeLayers(
    ...bundles.map((bundle) => bundle.user || []).flat(),
  );

  // Gather sasslayer for the user
  const userUses = userLayers.uses; //bundles.map((bundle) => bundle.user?.uses || "");
  const userFunctions = userLayers.functions; // bundles.map((bundle) => bundle.user?.functions || "");
  const userDefaults = userLayers.defaults; // bundles.map((bundle) => bundle.user?.defaults || "");
  const userRules = userLayers.rules; // bundles.map((bundle) => bundle.user?.rules || "");
  const userMixins = userLayers.mixins; // bundles.map((bundle) => bundle.user?.mixins || "");

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
  let scssInput = [
    `// quarto-scss-analysis-annotation { "quarto-version": "${quartoConfig.version()}" }`,
    '// quarto-scss-analysis-annotation { "origin": "\'use\' section from format" }',
    ...frameWorkUses,
    '// quarto-scss-analysis-annotation { "origin": "\'use\' section from Quarto" }',
    ...quartoUses,
    '// quarto-scss-analysis-annotation { "origin": "\'use\' section from user-defined SCSS" }',
    userUses,
    '// quarto-scss-analysis-annotation { "origin": "\'functions\' section from format" }',
    ...frameworkFunctions,
    '// quarto-scss-analysis-annotation { "origin": "\'functions\' section from Quarto" }',
    ...quartoFunctions,
    '// quarto-scss-analysis-annotation { "origin": "\'functions\' section from user-defined SCSS" }',
    userFunctions,
    '// quarto-scss-analysis-annotation { "origin": "Defaults from user-defined SCSS" }',
    userDefaults,
    '// quarto-scss-analysis-annotation { "origin": "Defaults from Quarto\'s SCSS" }',
    ...quartoDefaults.reverse(),
    '// quarto-scss-analysis-annotation { "origin": "Defaults from the format SCSS" }',
    ...frameworkDefaults.reverse(),
    '// quarto-scss-analysis-annotation { "origin": "\'mixins\' section from format" }',
    ...frameworkMixins,
    '// quarto-scss-analysis-annotation { "origin": "\'mixins\' section from Quarto" }',
    ...quartoMixins,
    '// quarto-scss-analysis-annotation { "origin": "\'mixins\' section from user-defined SCSS" }',
    userMixins,
    '// quarto-scss-analysis-annotation { "origin": "\'rules\' section from format" }',
    ...frameworkRules,
    '// quarto-scss-analysis-annotation { "origin": "\'rules\' section from Quarto" }',
    ...quartoRules,
    '// quarto-scss-analysis-annotation { "origin": "\'rules\' section from user-defined SCSS" }',
    userRules,
    '// quarto-scss-analysis-annotation { "origin": null }',
  ].join("\n\n");

  const saveScssPrefix = Deno.env.get("QUARTO_SAVE_SCSS");
  if (saveScssPrefix) {
    // Save the SCSS before compilation
    const counterValue = counter++;
    Deno.writeTextFileSync(
      `${saveScssPrefix}-${counterValue}.scss`,
      scssInput,
    );
  }

  // Compile the scss
  const result = await compileWithCache(
    scssInput,
    loadPaths,
    temp,
    {
      compressed: minified,
      cacheIdentifier: await md5HashBytes(new TextEncoder().encode(scssInput)),
      addVarsBlock: true,
    },
  );

  if (saveScssPrefix) {
    // The compilation succeeded, we can update the file with additional info
    const partialOutput = Deno.readTextFileSync(result);
    // now we attempt to find the SCSS variables in the output
    // and inject them back in the SCSS file so that our debug tooling can use them.
    const scssToWrite = [scssInput];
    const internalVars = Array.from(
      partialOutput.matchAll(/(--quarto-scss-export-[^;}]+;?)/g),
    ).map((m) => m[0]);
    const annotation = {
      "css-vars": internalVars,
    };
    scssToWrite.push(
      `// quarto-scss-analysis-annotation ${JSON.stringify(annotation)}`,
    );
    scssInput = scssToWrite.join("\n");
    Deno.writeTextFileSync(
      `${saveScssPrefix}-${counter}.scss`,
      scssInput,
    );
  }

  return result;
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

export function mergeLayers(...layers: SassLayer[]): SassLayer {
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
    uses: themeUses.join("\n"),
    // We need to reverse the order of defaults
    // since defaults override one another by being
    // set first
    defaults: themeDefaults.reverse().join("\n"),
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

type CompileWithCacheOptions = {
  compressed?: boolean;
  cacheIdentifier?: string;
  addVarsBlock?: boolean;
};

export async function compileWithCache(
  input: string,
  loadPaths: string[],
  temp: TempContext,
  options?: CompileWithCacheOptions,
) {
  const {
    compressed,
    cacheIdentifier,
    addVarsBlock,
  } = options || {};

  const handleVarsBlock = (input: string) => {
    if (!addVarsBlock) {
      return input;
    }
    try {
      input += "\n" + cssVarsBlock(input);
    } catch (e) {
      console.warn("Error adding css vars block", e);
      console.warn(
        "The resulting CSS file will not have SCSS color variables exported as CSS.",
      );
      Deno.writeTextFileSync("_quarto_internal_scss_error.scss", input);
      console.warn(
        "This is likely a Quarto bug.\nPlease consider reporting it at https://github.com/quarto-dev/quarto-cli,\nalong with the _quarto_internal_scss_error.scss file that can be found in the current working directory.",
      );
    }
    return input;
  };

  if (cacheIdentifier) {
    // If there are imports, the computed input Hash is incorrect
    // so we should be using a session cache which will cache
    // across renders, but not persistently
    const useSessionCache = input.match(/@import/);

    // check the cache
    const cacheDir = useSessionCache
      ? join(temp.baseDir, "sass")
      : quartoCacheDir("sass");
    // when using quarto session cache, we ensure to cleanup the cache files at TempContext cleanup
    const cache = await sassCache(cacheDir, useSessionCache ? temp : undefined);
    return cache.getOrSet(
      input,
      cacheIdentifier,
      async (outputFilePath: string) => {
        input = handleVarsBlock(input);
        await dartCompile(input, outputFilePath, temp, loadPaths, compressed);
      },
    );
  } else {
    input = handleVarsBlock(input);
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

// Clean sourceMappingUrl from css after saas compilation
export function cleanSourceMappingUrl(cssPath: string): void {
  const cleaned = Deno.readTextFileSync(cssPath).replaceAll(
    kSourceMappingRegexes[0],
    "",
  ).replaceAll(
    kSourceMappingRegexes[1],
    "",
  );
  Deno.writeTextFileSync(cssPath, cleaned.trim(), {
    mode: safeModeFromFile(cssPath),
  });
}
