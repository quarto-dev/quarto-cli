/*
* env.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { expandPath } from "./path.ts";

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

export function withPath(
  paths: { append?: string[]; prepend?: string[] },
): string {
  const delimiter = Deno.build.os === "windows" ? ";" : ":";

  const currentPath = Deno.env.get("PATH") || "";
  if (paths.append !== undefined && paths.prepend !== undefined) {
    // Nothing to append or prepend
    return currentPath;
  } else if (paths.append?.length === 0 && paths.prepend?.length === 0) {
    // Nothing to append or prepend
    return currentPath;
  } else {
    // Make a new path
    const modifiedPaths = [currentPath];
    if (paths.append) {
      modifiedPaths.unshift(...paths.append);
    }

    if (paths.prepend) {
      modifiedPaths.push(...paths.prepend);
    }
    return modifiedPaths.join(delimiter);
  }
}

export function suggestUserBinPaths() {
  if (Deno.build.os !== "windows") {
    // List of paths that we consider bin paths
    // in priority order (expanded and not)
    const possiblePaths = [
      "/usr/local/bin",
      "~/.local/bin",
      "~/bin",
    ];

    // Read the user path
    const pathRaw = Deno.env.get("PATH");
    const paths: string[] = pathRaw ? pathRaw.split(":") : [];

    // Filter the above list by what is in the user path
    return possiblePaths.filter((path) => {
      return paths.includes(path) || paths.includes(expandPath(path));
    });
  } else {
    throw new Error("suggestUserBinPaths not currently supported on Windows");
  }
}
