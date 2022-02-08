/*
* registry.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { execProcess } from "./process.ts";

export const kHKeyCurrentUser = "HKCU";
export const kHKeyLocalMachine = "HKLM";

export async function registryReadString(
  root: string | string[],
  key: string,
  value: string,
): Promise<string | undefined> {
  // if an array is passed then call each one in turn
  if (Array.isArray(root)) {
    for (const r of root) {
      const val = registryReadString(r, key, value);
      if (val !== undefined) {
        return val;
      }
    }
    return undefined;
  }

  // run reg query
  const kTypeString = "REG_SZ";
  const cmd = [
    "reg",
    "query",
    `${root}\\${key}`,
    "/v",
    value,
  ];
  const result = await execProcess({
    cmd,
    stdout: "piped",
    stderr: "null",
  });
  if (result.success && result.stdout) {
    const typePos = result.stdout?.indexOf(kTypeString);
    if (typePos !== -1) {
      return result.stdout.substring(typePos + kTypeString.length).trim();
    }
  }
  return undefined;
}
