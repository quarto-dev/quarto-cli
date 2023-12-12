/*
 * env.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

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
