/*
 * jupyter-shared.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { join } from "../../deno_ral/path.ts";
import { existsSync } from "fs/mod.ts";

import * as colors from "fmt/colors.ts";

import { pathWithForwardSlashes } from "../path.ts";

import { pythonExecForCaps } from "./exec.ts";
import { jupyterKernelspecs } from "./kernels.ts";
import { JupyterCapabilities, JupyterKernelspec } from "./types.ts";
import { isEnvDir } from "./capabilities.ts";

export async function jupyterCapabilitiesMessage(
  caps: JupyterCapabilities,
  indent = "",
) {
  const lines = [
    `Version: ${caps.versionMajor}.${caps.versionMinor}.${caps.versionPatch}${
      caps.conda ? " (Conda)" : ""
    }`,
    `Path: ${caps.executable}`,
    `Jupyter: ${caps.jupyter_core || "(None)"}`,
  ];
  if (caps.jupyter_core) {
    const kernels = Array.from((await jupyterKernelspecs()).values())
      .map((kernel: JupyterKernelspec) => kernel.name).join(", ");
    lines.push(`Kernels: ${kernels}`);
  }
  return lines.map((line: string) => `${indent}${line}`).join("\n");
}

export function jupyterInstallationMessage(
  caps: JupyterCapabilities,
  indent = "",
) {
  const lines = [
    "Jupyter is not available in this Python installation.",
    "Install with " +
    colors.bold(
      `${
        caps.conda
          ? "conda"
          : (pythonExecForCaps(caps, true)).join(" ") + " -m pip"
      } install jupyter`,
    ),
  ];
  return lines.map((line: string) => `${indent}${line}`).join("\n");
}

export function jupyterUnactivatedEnvMessage(
  caps: JupyterCapabilities,
  indent = "",
) {
  for (const path of Deno.readDirSync(Deno.cwd())) {
    if (path.isDirectory) {
      const targetPath = join(Deno.cwd(), path.name);
      // We may encounter a directory for which we
      // don't have permissions. If that happens, just ignore it
      try {
        if (isEnvDir(targetPath)) {
          try {
            if (
              !pathWithForwardSlashes(caps.executable).startsWith(
                pathWithForwardSlashes(targetPath),
              )
            ) {
              return indent + "There is an unactivated Python environment in " +
                colors.bold(path.name) + ". Did you forget to activate it?";
            }
          } catch {
            return undefined;
          }
        }
      } catch (err) {
        if (!(err instanceof Deno.errors.NotFound)) {
          throw err;
        }
      }
    }
  }

  // perhaps they haven't yet restored from requirements.txt or environment.yaml
  const kRequirementsTxt = "requirements.txt";
  const kEnvironmentYaml = "environment.yml";
  for (const envFile of [kRequirementsTxt, kEnvironmentYaml]) {
    if (existsSync(join(Deno.cwd(), envFile))) {
      return indent + "There is a " + colors.bold(envFile) +
        " file in this directory. " +
        "Is this for a " +
        (envFile === kRequirementsTxt ? "venv" : "conda env") +
        " that you need to restore?";
    }
  }

  return undefined;
}

export function pythonInstallationMessage(indent = "") {
  const lines = [
    "Unable to locate an installed version of Python 3.",
    "Install Python 3 from " + colors.bold("https://www.python.org/downloads/"),
  ];
  return lines.map((line: string) => `${indent}${line}`).join("\n");
}
