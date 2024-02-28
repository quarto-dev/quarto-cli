/*
* import-maps.ts
*
* Copyright (C) 2022 Posit Software, PBC
*
*/

import { join } from "../../deno_ral/path.ts";
import { mergeConfigs } from "../config.ts";

const fixPath = (path: string, prefix: string) => {
  if (prefix === "") {
    return path;
  }
  if (path.startsWith("./")) {
    //if (path.startsWith("./") && !path.endsWith("/")) {
    return "./" + join(prefix, path.slice(2));
  } else if (path.startsWith("../")) {
    return `./${prefix}/${path}`;
  }
  return path;
};

function resolveImports(
  imports: Record<string, string>,
): Record<string, string> {
  const resolvedImport: Record<string, string> = {};
  const importList = Object.entries(imports);
  for (const [key, value] of importList) {
    let good = false;
    let repeat = 0;
    let result = value;
    do {
      repeat++;
      let foundK: string | undefined = undefined;
      let foundV: string | undefined = undefined;
      for (const [newK, newV] of importList) {
        if (result.startsWith(newK)) {
          if (!foundK || foundK.length < newK.length) {
            foundK = newK;
            foundV = newV;
          }
        }
      }
      if (foundK && foundV) {
        result = `${foundV}${result.slice(foundK.length)}`;
      } else {
        if (
          result.startsWith("./") && !result.endsWith("/") &&
          !result.endsWith(".js") && !result.endsWith(".ts")
        ) {
          result = result + ".js";
        }
        resolvedImport[key] = result;
        good = true;
        break;
      }
    } while (repeat < importList.length);
    if (!good) {
      throw new Error("circular import prefixes can't be resolved");
    }
  }
  return resolvedImport;
}

function objectMap<T, U>(
  obj: Record<string, T>,
  f: (v: T) => U,
): Record<string, U> {
  return Object.fromEntries(Object.entries(obj).map(([key, v]) => [key, f(v)]));
}

function objectMapReKey<T, U>(
  obj: Record<string, T>,
  f: (key: string, v: T) => [string, U],
): Record<string, U> {
  return Object.fromEntries(Object.entries(obj).map(([key, v]) => f(key, v)));
}

function fixMap(map: Record<string, string>, prefix: string) {
  return objectMap(map, (v) => fixPath(v, prefix));
}

function fixMapReKey(map: Record<string, string>, prefix: string) {
  return objectMapReKey(
    map,
    (key, v) => [fixPath(key, prefix), fixPath(v, prefix)],
  );
}

export function mergeImportMaps(
  // deno-lint-ignore no-explicit-any
  ...entries: { importMap: any; prefix: string }[]
) {
  let imports: Record<string, string> = {};
  let scopes: Record<string, Record<string, string>> = {};

  for (const { importMap, prefix } of entries) {
    imports = mergeConfigs(imports, fixMap(importMap.imports || {}, prefix));
    scopes = mergeConfigs(
      scopes,
      objectMapReKey(
        importMap.scopes || {},
        // deno-lint-ignore no-explicit-any
        (key: string, v: any) => [fixPath(key, prefix), fixMapReKey(v, prefix)],
      ),
    );
  }
  return {
    imports: resolveImports(imports),
    scopes,
  };
}
