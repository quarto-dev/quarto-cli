import { DenoInfoDependency, Edge, getDenoInfo } from "./deno-info.ts";
import { brightBlue } from "jsr:/@std/fmt@^0.224.0/colors";
import { longestCommonDirPrefix } from "./utils.ts";

const allowedTerminalFileSuffixes = [
  "types.ts",
  "constants.ts",
  "schemas.ts",
  ".json",
];

function isBadImport(source: string, dep: DenoInfoDependency) {
  if (!(dep.code && dep.code.specifier)) {
    if (
      dep.type && dep.type.error &&
      dep.type.error.startsWith("Relative import path") &&
      source.indexOf("src/core/lib") !== -1 &&
      !allowedTerminalFileSuffixes.some((allowedSuffix) =>
        dep.type!.specifier!.endsWith(allowedSuffix)
      )
    ) {
      // report library imports from inside src/core/lib
      return true;
    } else {
      return false;
    }
  }
  const target = dep.code.specifier;
  if (
    allowedTerminalFileSuffixes.some((allowedSuffix) =>
      target.endsWith(allowedSuffix)
    )
  ) {
    return false;
  }
  if (
    source.indexOf("src/core/") !== -1 &&
    target.indexOf("src/core/") === -1
  ) {
    // report src/core imports to outside src/core
    return true;
  }
  if (
    source.indexOf("src/core/lib") !== -1 &&
    target.indexOf("src/core/lib") === -1
  ) {
    // report src/core/lib imports to outside src/core/lib
    return true;
  }
  return false;
}

if (import.meta.main) {
  const json = await getDenoInfo(Deno.args[0]);
  const result: Edge[] = [];
  const strs: string[] = [];
  for (const mod of json.modules) {
    const source = mod.specifier;
    for (const dep of mod.dependencies || []) {
      if (isBadImport(source, dep)) {
        if (dep.code) {
          result.push({ "from": source, to: dep.code.specifier! });
          strs.push(source, dep.code.specifier!);
        } else if (dep.type) {
          result.push({ "from": source, to: dep.type.specifier! });
          strs.push(source, dep.type.specifier!);
        } else {
          throw new Error(
            "don't know how to handle a dependency decl without code or type",
          );
        }
      }
    }
  }
  const p = longestCommonDirPrefix(strs).length;
  for (const { "from": edgeFrom, to } of result) {
    console.log(
      `Bad import from ${brightBlue(edgeFrom.slice(p))} to ${
        brightBlue(to.slice(p))
      }`,
    );
  }
}
