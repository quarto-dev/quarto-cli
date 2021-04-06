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

import { SassBundle, SassLayer } from "../../config/format.ts";
import { dartCompile } from "../../core/dart-sass.ts";

import { ld } from "lodash/mod.ts";

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
export function print(variable: SassVariable, isDefault = true): string {
  return `$${variable.name}: ${variable.value}${isDefault ? " !default" : ""};`;
}

export async function compileSass(bundles: SassBundle[]) {
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
  const frameworkDeclarations = bundles.map(
    (bundle) => bundle.framework?.declarations || "",
  );

  const frameworkVariables = bundles.map((bundle) =>
    bundle.framework?.variables || ""
  );

  const frameworkRules = bundles.map(
    (bundle) => bundle.framework?.rules || "",
  );

  // Gather sasslayer for quarto
  const quartoDeclarations = bundles.map((bundle) =>
    bundle.quarto?.declarations || ""
  );
  const quartoVariables = bundles.map((bundle) =>
    bundle.quarto?.variables || ""
  );
  const quartoRules = bundles.map((bundle) => bundle.quarto?.rules || "");

  // Gather sasslayer for the user
  const userDeclarations = bundles.map((bundle) =>
    bundle.user?.declarations || ""
  );
  const userVariables = bundles.map((bundle) => bundle.user?.variables || "");
  const userRules = bundles.map((bundle) => bundle.user?.rules || "");

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
    useStatements,
    ...frameworkDeclarations,
    ...quartoDeclarations,
    ...userDeclarations,
    ...userVariables.reverse(),
    ...quartoVariables.reverse(),
    ...frameworkVariables.reverse(),
    ...frameworkRules,
    ...quartoRules,
    ...userRules,
  ].join("\n\n");

  // Compile the scss
  return await compileWithCache(
    scssInput,
    loadPaths,
    true,
    bundles.map((bundle) => bundle.key).join("|"),
  );
}

const kLayerBoundary = /^\/\/[ \t]*theme:(variables|rules|declarations)[ \t]*$/;

export function mergeLayers(...layers: SassLayer[]) {
  const themeVariables: string[] = [];
  const themeRules: string[] = [];
  const themeDeclarations: string[] = [];
  layers.forEach((theme) => {
    if (theme.variables) {
      themeVariables.push(theme.variables);
    }

    if (theme.rules) {
      themeRules.push(theme.rules);
    }

    if (theme.declarations) {
      themeDeclarations.push(theme.declarations);
    }
  });

  return {
    variables: themeVariables.join("\n"),
    declarations: themeDeclarations.join("\n"),
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
        declarations: "_declarations.scss",
        variables: "_variables.scss",
        rules: "_rules.scss",
      },
    );
  }
}

export function sassLayerFile(theme: string): SassLayer {
  // It is not a built in theme, so read the theme file and parse it.
  const rawContents = Deno.readTextFileSync(theme);
  const lines = rawContents.split(/\r?\n/);

  const vars: string[] = [];
  const rules: string[] = [];
  const declarations: string[] = [];
  let accum = vars;
  lines.forEach((line) => {
    const scopeMatch = line.match(kLayerBoundary);
    if (scopeMatch) {
      const scope = scopeMatch[1];
      switch (scope) {
        case "variables":
          accum = vars;
          break;
        case "rules":
          accum = rules;
          break;
        case "declarations":
          accum = declarations;
          break;
      }
    } else {
      accum.push(line);
    }
  });

  return {
    variables: vars.join("\n"),
    rules: rules.join("\n"),
    declarations: declarations.join("\n"),
  };
}

export function sassLayerDir(
  dir: string,
  names: {
    declarations?: string;
    variables?: string;
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
    variables: read(names.variables),
    rules: read(names.rules),
    declarations: read(names.declarations),
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
    const identifierHash = createHash("md5").update(cacheIdentifier).toString();
    const inputHash = createHash("md5").update(input).toString();

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
