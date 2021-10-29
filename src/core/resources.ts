/*
* resources.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync, walkSync } from "fs/mod.ts";
import { join } from "path/mod.ts";
import { which } from "./path.ts";
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

export function binaryPath(binary: string): string {
  return join(quartoConfig.binPath(), binary);
}

export async function rBinaryPath(binary: string): Promise<string> {
  // if there is an R_HOME then respect that
  const rHome = Deno.env.get("R_HOME");
  if (rHome) {
    return join(rHome, "bin", binary);
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
      [kHKeyLocalMachine, kHKeyCurrentUser],
      "Software\\R-core\\R",
      "Current Version",
    );
    // determine path to version
    if (version) {
      const installPath = await registryReadString(
        [kHKeyLocalMachine, kHKeyCurrentUser],
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
