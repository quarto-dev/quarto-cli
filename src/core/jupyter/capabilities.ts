/*
* capabilities.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { isWindows } from "../platform.ts";
import { execProcess } from "../process.ts";
import { resourcePath } from "../resources.ts";
import { readYamlFromString } from "../yaml.ts";

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
}

// cache capabiliites per-process
let cachedJupyterCaps: JupyterCapabilities | undefined;

export async function jupyterCapabilities() {
  if (!cachedJupyterCaps) {
    // if we are on windows and have PY_PYTHON3 or PY_PYTHON defined
    // then force the use of the launcher from the get go
    if (isWindows() && pyPython()) {
      cachedJupyterCaps = await getPyLauncherJupyterCapabilities();
    } else {
      // initially probe the path
      // TODO: dodge windows store python
      // TODO: can we go straight for python3 on linux or does conda do 'python' there as well?
      cachedJupyterCaps = await getJupyterCapabilities(["python"]);

      // if this is conda and python >= 3 we are done, otherwise probe for python3 specifically
      if (!cachedJupyterCaps?.conda || cachedJupyterCaps.versionMajor >= 3) {
        const caps = isWindows()
          ? await getPyLauncherJupyterCapabilities()
          : await getJupyterCapabilities(["python3"]);
        if (caps) {
          cachedJupyterCaps = caps;
        }
        // ... otherwise just use the non-conda install we already found
      }
    }
  }

  return cachedJupyterCaps;
}

function pyPython() {
  return Deno.env.get("PY_PYTHON3") || Deno.env.get("PY_PYTHON");
}

function getPyLauncherJupyterCapabilities() {
  return getJupyterCapabilities(["py", "-3"], true);
}

async function getJupyterCapabilities(cmd: string[], pyLauncher = false) {
  try {
    const result = await execProcess({
      cmd: [
        ...cmd,
        resourcePath("capabilities/jupyter.py"),
      ],
      stdout: "piped",
    });
    if (result.success && result.stdout) {
      const caps = readYamlFromString(result.stdout) as JupyterCapabilities;
      caps.pyLauncher = pyLauncher;
      return caps;
    } else {
      return undefined;
    }
  } catch {
    return undefined;
  }
}
