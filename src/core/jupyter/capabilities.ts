/*
* capabilities.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";
import { existsSync } from "fs/mod.ts";

import * as colors from "fmt/colors.ts";

import { isWindows } from "../platform.ts";
import { execProcess } from "../process.ts";
import { resourcePath } from "../resources.ts";
import { readYamlFromString } from "../yaml.ts";
import { pathWithForwardSlashes } from "../path.ts";

import { pythonExec } from "./exec.ts";
import { JupyterKernelspec, jupyterKernelspecs } from "./kernels.ts";

export interface JupyterCapabilities {
  versionMajor: number;
  versionMinor: number;
  versionPatch: number;
  versionStr: string;
  execPrefix: string;
  executable: string;
  conda: boolean;
  pyLauncher: boolean;
  // deno-lint-ignore camelcase
  jupyter_core: string | null;
  nbformat: string | null;
  nbclient: string | null;
  ipykernel: string | null;
  kernels?: JupyterKernelspec[];
}

// cache capabiliites per-process
let cachedJupyterCaps: JupyterCapabilities | undefined;

export async function jupyterCapabilities() {
  if (!cachedJupyterCaps) {
    // if we are on windows and have PY_PYTHON defined then use the launcher
    if (isWindows() && pyPython()) {
      cachedJupyterCaps = await getPyLauncherJupyterCapabilities();
    }

    // default handling (also a fallthrough if launcher didn't work out)
    if (!cachedJupyterCaps) {
      // look for python from conda (conda doesn't provide python3 on windows or mac)
      cachedJupyterCaps = await getJupyterCapabilities(["python"]);

      // if it's not conda then probe explicitly for python 3
      if (!cachedJupyterCaps?.conda) {
        const caps = isWindows()
          ? await getPyLauncherJupyterCapabilities()
          : await getJupyterCapabilities(["python3"]);
        if (caps) {
          cachedJupyterCaps = caps;
        }
      }
    }
  }

  return cachedJupyterCaps;
}

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

export async function jupyterInstallationMessage(
  caps: JupyterCapabilities,
  indent = "",
) {
  const lines = [
    "Jupyter is not available in this Python installation.",
    "Install with " +
    colors.bold(
      `${
        caps.conda ? "conda" : (await pythonExec(true)).join(" ") + " -m pip"
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

export function isEnvDir(dir: string) {
  return existsSync(join(dir, "pyvenv.cfg")) ||
    existsSync(join(dir, "conda-meta"));
}

function pyPython() {
  return Deno.env.get("PY_PYTHON");
}

function getPyLauncherJupyterCapabilities() {
  return getJupyterCapabilities(["py"], true);
}

async function getJupyterCapabilities(cmd: string[], pyLauncher = false) {
  try {
    const result = await execProcess({
      cmd: [
        ...cmd,
        resourcePath("capabilities/jupyter.py"),
      ],
      stdout: "piped",
      stderr: "piped",
    });
    if (result.success && result.stdout) {
      const caps = readYamlFromString(result.stdout) as JupyterCapabilities;
      if (caps.versionMajor >= 3) {
        caps.pyLauncher = pyLauncher;
        return caps;
      } else {
        return undefined;
      }
    } else {
      return undefined;
    }
  } catch {
    return undefined;
  }
}
