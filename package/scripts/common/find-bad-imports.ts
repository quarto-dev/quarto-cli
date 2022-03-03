import { DenoInfoDependency, Edge, getDenoInfo } from "./deno-info.ts";
import { brightBlue } from "https://deno.land/std@0.122.0/fmt/colors.ts";

function isBadImport(source: string, dep: DenoInfoDependency) {
  if (!dep.code.specifier) {
    return false;
  }
  const target = dep.code.specifier;
  if (
    source.indexOf("src/core/") !== -1 &&
    target.indexOf("src/core/") === -1
  ) {
    return true;
  }
  if (
    source.indexOf("src/core/lib") !== -1 &&
    target.indexOf("src/core/lib") === -1
  ) {
    return true;
  }
  return false;
}

// https://stackoverflow.com/a/68702966
const longestCommonPrefix = (strs: string[]) => {
  let prefix = strs.reduce((acc, str) => str.length < acc.length ? str : acc);

  for (const str of strs) {
    while (str.slice(0, prefix.length) != prefix) {
      prefix = prefix.slice(0, -1);
    }
  }
  return prefix;
};

if (import.meta.main) {
  const json = await getDenoInfo(Deno.args[0]);
  const result: Edge[] = [];
  const strs: string[] = [];
  for (const mod of json.modules) {
    const source = mod.specifier;
    for (const dep of mod.dependencies || []) {
      if (isBadImport(source, dep)) {
        result.push({ "from": source, to: dep.code.specifier! });
        strs.push(source, dep.code.specifier!);
      }
    }
  }
  const p = longestCommonPrefix(strs).length;
  for (const { "from": edgeFrom, to } of result) {
    console.log(
      `Bad import from ${brightBlue(edgeFrom.slice(p))} to ${
        brightBlue(to.slice(p))
      }`,
    );
  }
}
