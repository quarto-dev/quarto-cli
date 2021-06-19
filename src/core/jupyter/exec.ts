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
    return ["python"];
  } else {
    return ["python3"];
  }
}

export async function jupyterExec(): Promise<string[]> {
  const caps = await jupyterCapabilities();
  if (caps?.pyLauncher) {
    return ["py", "-3", "-m", "jupyter"];
  } else {
    return ["jupyter"];
  }
}
