/*
 * exec.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { isWindows } from "../../deno_ral/platform.ts";
import { jupyterCapabilities } from "./capabilities.ts";
import { JupyterCapabilities, JupyterKernelspec } from "./types.ts";

export async function pythonExec(
  kernelspec?: JupyterKernelspec,
  binaryOnly = false,
): Promise<string[]> {
  const caps = await jupyterCapabilities(kernelspec);
  return pythonExecForCaps(caps, binaryOnly);
}

export function pythonExecForCaps(
  caps?: JupyterCapabilities,
  binaryOnly = false,
) {
  if (caps?.pyLauncher) {
    return ["py"];
  } else if (isWindows) {
    return [binaryOnly ? "python" : caps?.executable || "python"];
  } else {
    return [binaryOnly ? "python3" : caps?.executable || "python3"];
  }
}

export async function jupyterExec(
  kernelspec?: JupyterKernelspec,
): Promise<string[]> {
  return [
    ...(await pythonExec(kernelspec)),
    "-m",
    "jupyter",
  ];
}
