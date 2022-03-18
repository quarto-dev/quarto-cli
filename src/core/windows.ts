/*
* windows.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { existsSync } from "fs/mod.ts";
import { join } from "path/mod.ts";
import { quartoCacheDir } from "./appdirs.ts";
import { execProcess } from "./process.ts";
import {
  kHKeyCurrentUser,
  kHKeyLocalMachine,
  registryReadString,
} from "./registry.ts";

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

const tokenPath = join(quartoCacheDir(), "codepage");

export async function cacheCodePage() {
  if (!existsSync(tokenPath)) {
    const value = await registryReadString(
      [kHKeyLocalMachine, kHKeyCurrentUser],
      "SYSTEM\\CurrentControlSet\\Control\\Nls\\CodePage",
      "ACP",
    );

    if (value) {
      Deno.writeTextFileSync(tokenPath, value);
    }
  }
}

export function clearCodePageCache() {
  if (existsSync(tokenPath)) {
    Deno.removeSync(tokenPath);
  }
}

function readCodePageCache() {
  const codepage = Deno.readTextFileSync(tokenPath);
  if (codepage) {
    return codepage;
  } else {
    return undefined;
  }
}

export function readCodePage() {
  // Try reading our code page token, if that isn't present,
  try {
    const codepage = readCodePageCache();
    if (codepage) {
      return codepage;
    }
  } catch {
    throw new Error("Expected a cached code page for this installation");
  }
  return undefined;
}
