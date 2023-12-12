/*
* tools-info.ts
*
* Copyright (C) 2022 Posit Software, PBC
*
*/

import { expandPath, safeExistsSync } from "../../core/path.ts";
import { join } from "path/mod.ts";
import { getenv } from "../../core/env.ts";

import { existsSync } from "fs/mod.ts";

export function hasTinyTex(): boolean {
  const installDir = tinyTexInstallDir();
  if (installDir && existsSync(installDir)) {
    return true;
  } else {
    return false;
  }
}

export function tinyTexInstallDir(): string | undefined {
  switch (Deno.build.os) {
    case "windows":
      let appDir = getenv("APPDATA", undefined);
      // use ProgramData if APPDATA is not set or contains spaces or non-ASCII characters
      if (!appDir || !appDir.match(/^[!-~]+$/)) {
        appDir = getenv("ProgramData", undefined);
      }
      return expandPath(join(appDir, "TinyTeX"));
    case "linux":
      return expandPath("~/.TinyTeX");
    case "darwin":
      return expandPath("~/Library/TinyTeX");
    default:
      return undefined;
  }
}

export function tinyTexBinDir(): string | undefined {
  const basePath = tinyTexInstallDir();
  if (basePath) {
    switch (Deno.build.os) {
      case "windows": {
        // TeX Live 2023 use windows now. Previous version were using win32
        const winPath = join(basePath, "bin\\win32\\");
        if (safeExistsSync(winPath)) return (winPath);
        return join(basePath, "bin\\windows\\");
      }
      case "linux":
        return join(basePath, `bin/${Deno.build.arch}-linux`);
      case "darwin":
        return join(basePath, "bin/universal-darwin");
      default:
        return undefined;
    }
  } else {
    return undefined;
  }
}
