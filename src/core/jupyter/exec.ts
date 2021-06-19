/*
* exec.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { isWindows } from "../platform.ts";
import { jupyterCapabilities } from "./capabilities.ts";

export async function pythonExec(): Promise<string[]> {
  const caps = await jupyterCapabilities();
  if (caps?.pyLauncher) {
    return ["py", "-3"];
  } else if (isWindows()) {
    return [caps?.executable || "python"];
  } else {
    return [caps?.executable || "python3"];
  }
}

export async function jupyterExec(): Promise<string[]> {
  return [
    ...(await pythonExec()),
    "-m",
    "jupyter",
  ];
}
