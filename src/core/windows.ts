/*
 * windows.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { existsSync } from "fs/mod.ts";
import { join } from "../deno_ral/path.ts";
import { quartoCacheDir } from "./appdirs.ts";
import { removeIfExists } from "./path.ts";
import { execProcess } from "./process.ts";
import { ProcessResult } from "./process-types.ts";

import {
  kHKeyCurrentUser,
  kHKeyLocalMachine,
  registryReadString,
} from "./registry.ts";

export async function readRegistryKey(
  registryPath: string,
  keyname: string | "(Default)",
) {
  const defaultKeyname = keyname === "(Default)";
  // Build the the reg command
  const args = ["query", registryPath];
  if (defaultKeyname) {
    args.push("/ve");
  } else {
    args.push("/v");
    args.push(keyname);
  }

  // Run the command handling quotes on Windows
  const safeArgs = requireQuoting(args);
  const result = await safeWindowsExec(
    "reg.exe",
    safeArgs.args,
    (cmd: string[]) => {
      return execProcess({
        cmd,
        stdout: "piped",
        stderr: "piped",
      });
    },
  );

  // Check the result
  if (result.success) {
    // Parse the output to read the value
    const output = result.stdout;
    const regexStr = (defaultKeyname ? "" : ` *${keyname}`) +
      ` *(?:REG_SZ|REG_MULTI_SZ|REG_EXPAND_SZ|REG_DWORD|REG_BINARY|REG_NONE) *(.*)$`;
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
  const readCache = () => {
    const codepage = readCodePageCache();
    if (codepage) {
      return codepage;
    }
  };

  try {
    // Read the cache and return it
    return readCache();
  } catch {
    try {
      // Retry creating the cache
      cacheCodePage();
      return readCache();
    } catch {
      // We couldn't read the cache at all, so just give up
      return undefined;
    }
  }
}

// On Windows, determine and apply double quoting on args that needs it
// Do nothing on other OS.
export function requireQuoting(
  args: string[],
) {
  let requireQuoting = false;
  if (Deno.build.os === "windows") {
    // On Windows, we need to check if arguments may need quoting to avoid issue with Deno.Run()
    // https://github.com/quarto-dev/quarto-cli/issues/336
    const shellCharReg = new RegExp("[ <>()|\\:&;#?*']");
    args = args.map((a) => {
      if (shellCharReg.test(a)) {
        requireQuoting = true;
        return `"${a}"`;
      } else {
        return a;
      }
    });
  }
  return {
    status: requireQuoting,
    args: args,
  };
}

// Execute a program on Windows by writing command line
// to a tempfile and execute the file with CMD
export async function safeWindowsExec(
  program: string,
  args: string[],
  fnExec: (cmdExec: string[]) => Promise<ProcessResult>,
) {
  const tempFile = Deno.makeTempFileSync(
    { prefix: "quarto-safe-exec", suffix: ".bat" },
  );
  try {
    Deno.writeTextFileSync(tempFile, [program, ...args].join(" ") + "\n");
    return await fnExec(["cmd", "/c", tempFile]);
  } finally {
    removeIfExists(tempFile);
  }
}
