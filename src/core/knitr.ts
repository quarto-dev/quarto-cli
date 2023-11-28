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
import { debug } from "log/mod.ts";

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

export async function checkRBinary() {
  const rBin = await rBinaryPath("Rscript");
  try {
    const result = await execProcess({
      cmd: [rBin, "--version"],
      stdout: "piped",
    });
    if (result.success && result.stdout) {
      debug(`\n++R found at ${rBin} is working.`);
      return rBin;
    } else {
      debug(`\n++R found at ${rBin} is not working properly.`);
      return undefined;
    }
  } catch {
    debug(
      `\n++ Error while checking R binary found at ${rBin}`,
    );
    return undefined;
  }
}

export async function knitrCapabilities(rBin: string | undefined) {
  if (!rBin) return undefined;
  try {
    debug(`-- Checking knitr engine capabilities --`);
    const result = await execProcess({
      cmd: [rBin, resourcePath("capabilities/knitr.R")],
      stdout: "piped",
    });
    if (result.success && result.stdout) {
      debug(
        "\n++ Parsing results to get informations about knitr capabilities",
      );
      const yamlLines = result.stdout
        .replace(/^.*--- YAML_START ---/sm, "")
        .replace(/--- YAML_END ---.*$/sm, "");

      const caps = readYamlFromString(yamlLines) as KnitrCapabilities;
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
      debug("\n++ Problem with results of knitr capabilities check.");
      debug(`    Return Code: ${result.code} (success is ${result.success})`);
      result.stdout
        ? debug(`    with stdout from R:\n${result.stdout}`)
        : debug("    with no stdout");
      if (result.stderr) {
        debug(`    with stderr from R:\n${result.stderr}`);
      }
      return undefined;
    }
  } catch {
    debug(
      `\n++ Error while running 'capabilities/knitr.R' ${
        rBin ? "with " + rBin : ""
      }`,
    );
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
