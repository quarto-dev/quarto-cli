/*
* knitr.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import * as colors from "fmt/colors.ts";

import { execProcess } from "./process.ts";
import { rBinaryPath, resourcePath } from "./resources.ts";
import { readYamlFromString } from "./yaml.ts";

export interface KnitrCapabilities {
  versionMajor: number;
  versionMinor: number;
  versionPatch: number;
  home: string;
  libPaths: string[];
  rmarkdown: string | null;
}

export async function knitrCapabilities() {
  try {
    const result = await execProcess({
      cmd: [
        await rBinaryPath("Rscript"),
        resourcePath("capabilities/knitr.R"),
      ],
      stdout: "piped",
    });
    if (result.success && result.stdout) {
      const caps = readYamlFromString(result.stdout) as KnitrCapabilities;
      return caps;
    } else {
      return undefined;
    }
  } catch {
    return undefined;
  }
}

export function knitrCapabilitiesMessage(caps: KnitrCapabilities, indent = "") {
  const lines = [
    `Version: ${caps.versionMajor}.${caps.versionMinor}.${caps.versionPatch}`,
    `Path: ${caps.home}`,
    `LibPaths:`,
  ];
  for (const path of caps.libPaths) {
    lines.push(`  - ${path}`);
  }
  lines.push(`rmarkdown: ${caps.rmarkdown || "(None)"}`);
  return lines.map((line: string) => `${indent}${line}`).join("\n");
}

export function knitrInstallationMessage(indent = "") {
  const lines = [
    "The rmarkdown package is not available in this R installation.",
    "Install with " + colors.bold('install.packages("rmarkdown")'),
  ];
  return lines.map((line: string) => `${indent}${line}`).join("\n");
}

export function rInstallationMessage(indent = "") {
  const lines = [
    "Unable to locate an installed version of R.",
    "Install R from " + colors.bold("https://cloud.r-project.org/"),
  ];
  return lines.map((line: string) => `${indent}${line}`).join("\n");
}
