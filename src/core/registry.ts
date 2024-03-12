/*
 * registry.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { ProcessResult } from "./process-types.ts";
import { execProcess } from "./process.ts";
import { debugOnce } from "./log.ts";

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
      const val = await registryReadString(r, key, value);
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
  let result: ProcessResult;
  try {
    result = await execProcess(cmd[0], {
      args: cmd.slice(1),
      stdout: "piped",
      stderr: "null",
    });
  } catch (e) {
    debugOnce(`Fail to read from registry: ${e}`);
    return undefined;
  }
  if (result.success && result.stdout) {
    const typePos = result.stdout?.indexOf(kTypeString);
    if (typePos !== -1) {
      return result.stdout.substring(typePos + kTypeString.length).trim();
    }
  }
  return undefined;
}
