/*
 * resources.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { existsSync, walkSync } from "fs/mod.ts";
import { dirname, join } from "path/mod.ts";
import { warnOnce } from "./log.ts";
import { safeExistsSync, which } from "./path.ts";
import { quartoConfig } from "./quarto.ts";
import {
  kHKeyCurrentUser,
  kHKeyLocalMachine,
  registryReadString,
} from "./registry.ts";

export function resourcePath(resource?: string): string {
  const sharePath = quartoConfig.sharePath();
  if (resource) {
    return join(sharePath, resource);
  } else {
    return sharePath;
  }
}

export function formatResourcePath(format: string, resource: string) {
  return join(resourcePath("formats"), format, resource);
}

export function architectureToolsPath(path: string) {
  const arch = Deno.build.arch;
  const archDir = join(arch, path);
  return toolsPath(archDir);
}

export function toolsPath(binary: string): string {
  const displayWarning = () => {
    warnOnce(
      `Specified ${binaryEnvKey} does not exist, using built in ${binary}`,
    );
  };

  const binaryEnvKey = `QUARTO_${binary.toUpperCase()}`;
  const binaryPath = Deno.env.get(binaryEnvKey);
  if (binaryPath) {
    if (!existsSync(binaryPath)) {
      // If this is windows, we shouldn't warn if there is an 'exe' version of the path
      if (Deno.build.os === "windows") {
        const exeExists = !binary.endsWith(".exe") ||
          [binary + ".exe"].some((path) => {
            return existsSync(path);
          });
        // Even the exe version of this path doesn't exist, warn
        if (!exeExists) {
          displayWarning();
        }
      } else {
        displayWarning();
      }
    } else {
      if (Deno.statSync(binaryPath).isFile) {
        return binaryPath;
      } else {
        const fullPath = join(binaryPath, binary);
        if (!existsSync(fullPath)) {
          displayWarning();
        } else {
          return fullPath;
        }
      }
    }
  }

  return join(quartoConfig.toolsPath(), binary);
}

export function pandocBinaryPath(): string {
  return architectureToolsPath("pandoc");
}

export async function rBinaryPath(binary: string): Promise<string> {
  // if there is a QUARTO_R environment variable then respect that
  const quartoR = Deno.env.get("QUARTO_R");
  if (quartoR && existsSync(quartoR)) {
    const rBinDir = Deno.statSync(quartoR).isDirectory
      ? quartoR
      : dirname(quartoR);
    return join(rBinDir, binary);
  }

  // if there is an R_HOME then respect that
  const rHome = Deno.env.get("R_HOME");
  if (rHome) {
    let rHomeBin = join(rHome, "bin", binary);
    if (safeExistsSync(rHomeBin)) return rHomeBin;
    if (Deno.build.os === "windows") {
      // Some installation have binaries in the sub folder only
      rHomeBin = join(rHome, "bin", "x64", binary);
      if (safeExistsSync(rHomeBin)) return rHomeBin;
    }
  }

  // then check the path
  const path = await which(binary);
  if (path) {
    return path;
  }

  // on windows check the registry for a current version
  if (Deno.build.os === "windows") {
    // determine current version
    const version = await registryReadString(
      [kHKeyCurrentUser, kHKeyLocalMachine],
      "Software\\R-core\\R",
      "Current Version",
    );
    // determine path to version
    if (version) {
      const installPath = await registryReadString(
        [kHKeyCurrentUser, kHKeyLocalMachine],
        `Software\\R-core\\R\\${version}`,
        "InstallPath",
      );
      if (installPath) {
        return join(installPath, "bin", binary);
      }
    }
    // last ditch, try to find R in program files
    const progFiles = Deno.env.get("programfiles");
    if (progFiles) {
      // Search program files for the binary
      for (const entry of Deno.readDirSync(progFiles)) {
        if (entry.isDirectory && entry.name === "R") {
          // found the R directory, now walk to find bin directory
          for (const walk of walkSync(join(progFiles, "R"))) {
            if (walk.isDirectory && walk.name === "bin") {
              return join(walk.path, binary);
            }
          }
        }
      }
    }
  }

  // We couldn't find R, just pass the binary itself and hope it works out!
  return binary;
}

export function projectTypeResourcePath(projectType: string) {
  return resourcePath(join("projects", projectType));
}

const kDarkSuffix = "dark";
const kLightSuffix = "light";

export function textHighlightThemePath(
  theme: string,
  style?: "dark" | "light",
) {
  // First try the style specific version of the theme, otherwise
  // fall back to the plain name
  const names = [
    `${theme}-${style === "dark" ? kDarkSuffix : kLightSuffix}`,
    theme,
  ];
  const themePath = names.map((name) => {
    return resourcePath(join("pandoc", "highlight-styles", `${name}.theme`));
  }).find((path) => existsSync(path));
  return themePath;
}
