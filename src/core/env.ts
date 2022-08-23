/*
* env.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { expandPath, collapsePath } from "./path.ts";
import { info } from "log/mod.ts";

export function getenv(name: string, defaultValue?: string) {
  const value = Deno.env.get(name);
  if (value === undefined) {
    if (defaultValue === undefined) {
      throw new Error(`Required environment variable ${name} not specified.`);
    } else {
      return defaultValue;
    }
  } else {
    return value;
  }
}

export async function suggestUserBinPaths() {
  // List of paths that we consider bin paths
  // in priority order (expanded and not)
  let possiblePaths = [
      "~/.local/bin",
      "~/bin",
    ];
  let pathDelimiter = ":";
  if (Deno.build.os === "windows") {
    pathDelimiter = ";";
  } else {
    // /usr/local/bin on windows is not great. Permissions errors, plus
    //     it's hard to know whether to translate it (cygpath) or try to
    //     use it directly.
    possiblePaths.push("/usr/local/bin");
  }

  // Read the user path
  const pathRaw = Deno.env.get("PATH");
  let paths: string[] = pathRaw ? pathRaw.split(pathDelimiter) : [];
  paths = paths.map((path) => expandPath(path));
  possiblePaths = possiblePaths.map((path) => expandPath(path));

  // Filter the above list by what is in the user path
  return possiblePaths.filter((path) => {
    const onPath = paths.includes(path);
    if (!onPath) {
      info(`Filtering out ${collapsePath(path)} because it is not in the user PATH.`);
    }
    return onPath
  });
}
