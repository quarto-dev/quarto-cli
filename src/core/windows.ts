/*
* windows.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { join } from "path/mod.ts";
import { quartoCacheDir } from "./appdirs.ts";
import { execProcess } from "./process.ts";

export async function readRegistryKey(
  registryPath: string,
  keyname: string | "(Default)",
) {
  // Build the the reg command
  const cmd = ["reg.exe", "query", registryPath];
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
      ` *${keyname} *(?:REG_SZ|REG_MULTI_SZ|REG_EXPAND_SZ|REG_DWORD|REG_BINARY|REG_NONE) *(.*)$`;
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

export function windowsCodePage() {
  /*
  const value = await registryReadString(
    [kHKeyLocalMachine, kHKeyCurrentUser],
    "SYSTEM\\CurrentControlSet\\Control\\Nls\\CodePage",
    "ACP",
  );
  */

  // Try reading our code page token, if that isn't present,
  const tokenPath = join(quartoCacheDir(), "codepage");
  try {
    const codepage = Deno.readTextFileSync(tokenPath);
    if (codepage) {
      return codepage;
    }
  } catch {
    // Ignore this error
  }
  return undefined;
}
