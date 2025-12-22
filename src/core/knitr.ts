/*
 * knitr.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import * as colors from "fmt/colors";

import { execProcess } from "./process.ts";
import { rBinaryPath, resourcePath } from "./resources.ts";
import { readYamlFromString } from "./yaml.ts";
import { coerce, satisfies } from "semver/mod.ts";
import { debug } from "../deno_ral/log.ts";

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
  rmarkdownVersOk?: boolean;
}

const pkgVersRequirement = {
  knitr: {
    type: ">=",
    version: "1.30",
  },
  rmarkdown: {
    type: ">=",
    version: "2.3",
  },
};

export async function checkRBinary() {
  const rBin = await rBinaryPath("Rscript");
  try {
    const result = await execProcess({
      cmd: rBin,
      args: ["--version"],
      stdout: "piped",
      stderr: "piped",
    });
    // Before R4.2.3, the output version information is printed to stderr
    if (
      result.success &&
      (result.stdout ||
        /R scripting front-end version/.test(result.stderr ?? ""))
    ) {
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

export class WindowsArmX64RError extends Error {
  constructor(msg: string) {
    super(msg);
  }
}

export async function knitrCapabilities(rBin: string | undefined) {
  if (!rBin) return undefined;
  try {
    debug(`-- Checking knitr engine capabilities --`);
    const result = await execProcess({
      cmd: rBin,
      args: [resourcePath("capabilities/knitr.R")],
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
      const rmarkdownVersion = caps.packages.rmarkdown
        ? coerce(caps.packages.rmarkdown)
        : undefined;
      caps.packages.rmarkdownVersOk = rmarkdownVersion
        ? satisfies(
          rmarkdownVersion,
          Object.values(pkgVersRequirement["rmarkdown"]).join(" "),
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

      // Check for x64 R crashes on ARM Windows
      // These specific error codes only occur when x64 R crashes on ARM Windows
      const isX64RCrashOnArm =
        result.code === -1073741569 ||  // STATUS_NOT_SUPPORTED (native ARM hardware)
        result.code === -1073741819;    // STATUS_ACCESS_VIOLATION (Windows ARM VM on Mac)

      if (isX64RCrashOnArm) {
        throw new WindowsArmX64RError(
          "x64 R detected on Windows ARM.\n\n" +
            "x64 R runs under emulation and is not reliable for Quarto.\n" +
            "Please install native ARM64 R. \n" +
            "Read about R on 64-bit Windows ARM at https://blog.r-project.org/2024/04/23/r-on-64-bit-arm-windows/\n" +
            "After installation, set QUARTO_R environment variable if the correct version is not correctly found.",
        );
      }

      return undefined;
    }
  } catch (e) {
    // Rethrow x64-on-ARM errors - these have helpful messages
    if (e instanceof WindowsArmX64RError) {
      throw e;
    }
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
  if (caps.packages.rmarkdown && !caps.packages.rmarkdownVersOk) {
    lines.push(
      `NOTE: rmarkdown version ${caps.packages.rmarkdown} is too old. Please upgrade to ${pkgVersRequirement.rmarkdown.version} or later.`,
    );
  }
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
