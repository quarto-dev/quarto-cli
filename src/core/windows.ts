/*
 * windows.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { existsSync, safeRemoveSync } from "../deno_ral/fs.ts";
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
import { isWindows } from "../deno_ral/platform.ts";

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
        cmd: cmd[0],
        args: cmd.slice(1),
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
    safeRemoveSync(tokenPath);
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
  // TODO - we probably shouldn't be calling this if we're not on windows
  let requireQuoting = false;
  if (isWindows) {
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
    Deno.writeTextFileSync(
      tempFile,
      ["@echo off", [program, ...args].join(" ")].join("\n"),
    );
    return await fnExec(["cmd", "/c", tempFile]);
  } finally {
    removeIfExists(tempFile);
  }
}

// Detect Windows ARM hardware using IsWow64Process2 API
// Returns true if running on ARM64 hardware (even from x64 Deno under emulation)
//
// Background: Deno.build.arch reports the architecture Deno was compiled for,
// not the actual hardware architecture. When x64 Deno runs on ARM64 under
// WOW64 emulation, Deno.build.arch still reports "x86_64".
//
// Solution: Use Windows IsWow64Process2 API which returns the native machine
// architecture regardless of emulation. This is a standard Windows API function
// available since Windows 10 (kernel32.dll is always present on Windows).
//
// Reference: Validated approach from https://github.com/cderv/quarto-windows-arm
// See: https://learn.microsoft.com/en-us/windows/win32/api/wow64apiset/nf-wow64apiset-iswow64process2
export function isWindowsArm(): boolean {
  if (!isWindows) {
    return false;
  }

  try {
    // Load kernel32.dll
    const kernel32 = Deno.dlopen("kernel32.dll", {
      IsWow64Process2: {
        parameters: ["pointer", "pointer", "pointer"],
        result: "i32",
      },
      GetCurrentProcess: {
        parameters: [],
        result: "pointer",
      },
    });

    // Get current process handle
    const hProcess = kernel32.symbols.GetCurrentProcess();

    // Prepare output parameters - allocate buffer for USHORT (2 bytes each)
    const processMachineBuffer = new Uint16Array(1);
    const nativeMachineBuffer = new Uint16Array(1);

    // Call IsWow64Process2 with pointers to buffers
    const result = kernel32.symbols.IsWow64Process2(
      hProcess,
      Deno.UnsafePointer.of(processMachineBuffer),
      Deno.UnsafePointer.of(nativeMachineBuffer),
    );

    kernel32.close();

    if (result === 0) {
      // Function failed
      return false;
    }

    // IMAGE_FILE_MACHINE_ARM64 = 0xAA64 = 43620
    const IMAGE_FILE_MACHINE_ARM64 = 0xAA64;
    return nativeMachineBuffer[0] === IMAGE_FILE_MACHINE_ARM64;
  } catch {
    // IsWow64Process2 not available (Windows < 10) or other error
    return false;
  }
}
