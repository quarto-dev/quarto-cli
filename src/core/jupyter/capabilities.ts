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
    // then try to use the launcher
    if (isWindows() && pyPython()) {
      cachedJupyterCaps = await getPyLauncherJupyterCapabilities();
    }

    // default handling (also a fallthrough if launcher didn't work out)
    if (!cachedJupyterCaps) {
      // look for python from conda (conda doesn't provide python3 on windows or mac)
      const caps = await getJupyterCapabilities(["python"]);

      // if it's conda w/ python >= 3 then we are done
      if (caps?.conda && caps.versionMajor >= 3) {
        cachedJupyterCaps = caps;
      } else { // otherwise try to find python 3 explicitly
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
