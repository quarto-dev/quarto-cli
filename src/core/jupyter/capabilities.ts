/*
* capabilities.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { execProcess } from "../process.ts";
import { resourcePath } from "../resources.ts";
import { readYamlFromString } from "../yaml.ts";
import { JupyterKernelspec, jupyterKernelspecs } from "./kernels.ts";

export function pythonBinary() {
  if (Deno.build.os === "windows") {
    return "python";
  } else {
    return "python3";
  }
}

export interface JupyterCapabilities {
  versionMajor: number;
  versionMinor: number;
  versionPatch: number;
  versionStr: string;
  conda: boolean;
  execPrefix: string;
  executable: string;
  kernels: JupyterKernelspec[] | null;
  // deno-lint-ignore camelcase
  jupyter_core: string | null;
  nbformat: string | null;
  nbclient: string | null;
  ipykernel: string | null;
  yaml: string | null;
}

export async function jupyterCapabilities() {
  try {
    const result = await execProcess({
      cmd: [
        pythonBinary(),
        resourcePath("capabilities/jupyter.py"),
      ],
      stdout: "piped",
    });
    if (result.success && result.stdout) {
      const caps = readYamlFromString(result.stdout) as JupyterCapabilities;
      if (caps.jupyter_core !== null) {
        caps.kernels = Array.from((await jupyterKernelspecs()).values());
      } else {
        caps.kernels = null;
      }
      return caps;
    } else {
      return undefined;
    }
  } catch {
    return undefined;
  }
}
