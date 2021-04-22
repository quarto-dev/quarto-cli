/*
* windows.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { execProcess } from "./process.ts";

export async function readRegistryKey(
  registryPath: string,
  keyname: string | "(Default)",
) {
  // Build the the reg command
  const cmd = ["reg", "query", registryPath];
  if (keyname === "(Default)") {
    cmd.push("/ve");
    keyname = "\\(Default\\)";
  } else {
    cmd.push("/v");
    cmd.push(keyname);
  }

  // Run the command
  const result = await execProcess({
    cmd,
    stdout: "piped",
    stderr: "piped",
  });

  // Check the result
  if (result.success) {
    // Parse the output to read the value
    const output = result.stdout;
    const regexStr =
      `*${keyname} *(?:REG_SZ|REG_MULTI_SZ|REG_EXPAND_SZ|REG_DWORD|REG_BINARY|REG_NONE) *(.*)$`;
    const match = output?.match(RegExp(regexStr, "m"));
    if (match) {
      return match[1];
    } else {
      return undefined;
    }
  } else {
    return undefined;
  }
}
