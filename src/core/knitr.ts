/*
 * knitr.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import * as colors from "fmt/colors.ts";

import { execProcess } from "./process.ts";
import { rBinaryPath, resourcePath } from "./resources.ts";
import { readYamlFromString } from "./yaml.ts";
import { coerce, satisfies } from "semver/mod.ts";

export interface KnitrCapabilities {
  versionMajor: number;
  versionMinor: number;
  versionPatch: number;
  home: string;
  libPaths: string[];
  packages: KnitrRequiredPackages;
}

export interface KnitrRequiredPackages {
  knitr: string | null;
  knitrVersOk?: boolean;
  rmarkdown: string | null;
}

const pkgVersRequirement = {
  knitr: {
    type: ">=",
    version: "1.30",
  },
};

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
      const jsonLines = result.stdout
        .replace(/^.*--- YAML_START ---/sm, "")
        .replace(/--- YAML_END ---.*$/sm, "");

      const caps = readYamlFromString(jsonLines) as KnitrCapabilities;
      // check knitr requirement
      const knitrVersion = caps.packages.knitr
        ? coerce(caps.packages.knitr)
        : undefined;
      caps.packages.knitrVersOk = knitrVersion
        ? satisfies(
          knitrVersion,
          Object.values(pkgVersRequirement["knitr"]).join(" "),
        )
        : false;
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
  lines.push(`knitr: ${caps.packages.knitr || "(None)"}`);
  if (caps.packages.knitr && !caps.packages.knitrVersOk) {
    lines.push(
      `NOTE: knitr version ${caps.packages.knitr} is too old. Please upgrade to ${pkgVersRequirement.knitr.version} or later.`,
    );
  }
  lines.push(`rmarkdown: ${caps.packages.rmarkdown || "(None)"}`);
  return lines.map((line: string) => `${indent}${line}`).join("\n");
}

export function knitrInstallationMessage(
  indent = "",
  pkg = "rmarkdown",
  update = false,
) {
  const lines = [
    `The ${pkg} package is ${
      update ? "outdated" : "not available"
    } in this R installation.`,
  ];
  if (update) {
    lines.push(
      "Update with " + colors.bold(`update.packages("${pkg}")`),
    );
  } else {
    lines.push(
      "Install with " + colors.bold(`install.packages("${pkg}")`),
    );
  }
  return lines.map((line: string) => `${indent}${line}`).join("\n");
}

export function rInstallationMessage(indent = "") {
  const lines = [
    "Unable to locate an installed version of R.",
    "Install R from " + colors.bold("https://cloud.r-project.org/"),
  ];
  return lines.map((line: string) => `${indent}${line}`).join("\n");
}
