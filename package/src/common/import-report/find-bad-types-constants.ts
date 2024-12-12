import { DenoInfoDependency, Edge, getDenoInfo } from "./deno-info.ts";
import { brightBlue } from "jsr:/@std/fmt@^0.224.0/colors";
import { longestCommonDirPrefix } from "./utils.ts";

function isBadImportTypes(source: string, dep: DenoInfoDependency) {
  if (
    !(source.endsWith("types.ts") ||
      source.endsWith("constants.ts"))
  ) {
    return false;
  }
  if (dep?.code?.specifier) {
    if (
      !(dep.code.specifier.endsWith("types.ts") ||
        dep.code.specifier.endsWith("constants.ts"))
    ) {
      return true;
    }
  }
}

if (import.meta.main) {
  const json = await getDenoInfo(Deno.args[0]);
  const result: Edge[] = [];
  const strs: string[] = [];
  for (const mod of json.modules) {
    const source = mod.specifier;
    for (const dep of mod.dependencies || []) {
      if (dep.code && isBadImportTypes(source, dep)) {
        result.push({ "from": source, to: dep.code.specifier! });
        strs.push(source, dep.code.specifier!);
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
