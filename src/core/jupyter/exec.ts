/*
* exec.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { isWindows } from "../platform.ts";
import { jupyterCapabilities } from "./capabilities.ts";

export async function pythonExec(binaryOnly = false): Promise<string[]> {
  const caps = await jupyterCapabilities();
  if (caps?.pyLauncher) {
    return ["py", "-3"];
  } else if (isWindows()) {
    return [binaryOnly ? "python" : caps?.executable || "python"];
  } else {
    return [binaryOnly ? "python3" : caps?.executable || "python3"];
  }
}

export async function jupyterExec(): Promise<string[]> {
  return [
    ...(await pythonExec()),
    "-m",
    "jupyter",
  ];
}
