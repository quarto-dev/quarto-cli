/*
 * capabilities.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { isAbsolute, join } from "../../deno_ral/path.ts";
import { existsSync, expandGlobSync } from "../../deno_ral/fs.ts";

import { isWindows } from "../../deno_ral/platform.ts";
import { execProcess } from "../process.ts";
import { resourcePath } from "../resources.ts";
import { readYamlFromString } from "../yaml.ts";
import { which } from "../path.ts";

import { JupyterCapabilities, JupyterKernelspec } from "./types.ts";
import { warnOnce } from "../log.ts";
import { debug } from "../../deno_ral/log.ts";

// cache capabilities per language
const kNoLanguage = "(none)";
const jupyterCapsCache = new Map<string, JupyterCapabilities>();

export async function jupyterCapabilities(kernelspec?: JupyterKernelspec) {
  const language = kernelspec?.language || kNoLanguage;

  if (!jupyterCapsCache.has(language)) {
    debug(
      "Looking for Python binaries and Jupyter capabilities" +
        (language === kNoLanguage ? "." : ` for language '${language}'.`),
    );

    // if we are targeting julia then prefer the julia installed miniconda
    let juliaCaps: JupyterCapabilities | undefined;
    if (language === "julia") {
      juliaCaps = await getVerifiedJuliaCondaJupyterCapabilities();
      if (juliaCaps) {
        debug(
          `Using Jupyter capabilities from Julia conda at '${juliaCaps.executable}'`,
        );
        jupyterCapsCache.set(language, juliaCaps);
        return juliaCaps;
      }
    }

    // if there is an explicit python requested then use it
    const quartoCaps = await getQuartoJupyterCapabilities();
    if (quartoCaps) {
      debug(
        `Python found using QUARTO_PYTHON at '${quartoCaps.executable}'`,
      );
      jupyterCapsCache.set(language, quartoCaps);
      return quartoCaps;
    }

    // if we are on windows and have PY_PYTHON defined then use the launcher
    if (isWindows && pyPython()) {
      const pyLauncherCaps = await getPyLauncherJupyterCapabilities();
      if (pyLauncherCaps) {
        debug(
          `Python found via "py.exe" at ${pyLauncherCaps.executable}.`,
        );
        jupyterCapsCache.set(language, pyLauncherCaps);
      }
    }

    // default handling (also a fallthrough if launcher didn't work out)
    if (!jupyterCapsCache.has(language)) {
      // look for python from conda (conda doesn't provide python3 on windows or mac)
      debug("Looking for Jupyter capabilities from conda 'python' binary");
      const condaCaps = await getJupyterCapabilities(["python"]);
      if (condaCaps?.conda) {
        debug(
          `Python found using conda at '${condaCaps.executable}'`,
        );
        jupyterCapsCache.set(language, condaCaps);
      } else {
        const caps = isWindows
          ? await getPyLauncherJupyterCapabilities()
          : await getJupyterCapabilities(["python3"]);
        if (caps) {
          debug(
            `Python found at '${caps.executable}'`,
          );
          jupyterCapsCache.set(language, caps);
        }
      }

      // if the version we discovered doesn't have jupyter and we have a julia provided
      // jupyter then go ahead and use that
      if (!jupyterCapsCache.get(language)?.jupyter_core && juliaCaps) {
        debug(
          `No Jupyter capabilities found for '${language}' in ${
            jupyterCapsCache.get(language)?.executable
          }, falling back to Julia conda at '${juliaCaps.executable}'`,
        );
        jupyterCapsCache.set(language, juliaCaps);
      }
    }
  }

  return jupyterCapsCache.get(language);
}

// Does deno not have a set of S_* constants for stat?
// https://deno.land/std@0.97.0/node/fs.ts?doc=&s=constants.S_IXUSR
const S_IXUSR = 0o100;

async function getVerifiedJuliaCondaJupyterCapabilities() {
  debug("Looking for Jupyter capabilities from Julia conda");
  let juliaHome = Deno.env.get("JULIA_HOME");
  if (!juliaHome) {
    const home = isWindows ? Deno.env.get("USERPROFILE") : Deno.env.get("HOME");
    if (home) {
      juliaHome = join(home, ".julia");
    }
  }

  if (juliaHome) {
    const juliaCondaPath = join(juliaHome, "conda", "3");
    const bin = isWindows
      ? ["python3.exe", "python.exe"]
      : [join("bin", "python3"), join("bin", "python")];

    for (const pythonBin of bin) {
      const juliaPython = join(
        juliaCondaPath,
        pythonBin,
      );
      if (existsSync(juliaPython)) {
        debug(`Checking Jupyter capabilities for '${juliaPython}'`);
        const caps = await getJupyterCapabilities([juliaPython]);
        if (caps?.jupyter_core) {
          debug(
            `Python with Jupyter found at '${caps.executable}' from Julia conda`,
          );
          return caps;
        }
      }
    }

    for (
      const path of expandGlobSync(join(juliaCondaPath, "**", "python*"), {
        globstar: true,
      })
    ) {
      // check if this is an executable binary
      const file = Deno.statSync(path.path);
      if (!(file.isFile && file.mode && (file.mode & S_IXUSR))) {
        continue;
      }
      debug(`Checking Jupyter capabilities for '${path.path}'`);
      const caps = await getJupyterCapabilities([path.path]);
      if (caps?.jupyter_core) {
        debug(
          `Python with Jupyter found at '${caps.executable}' from Julia conda`,
        );
        return caps;
      }
    }
  }
}

async function getQuartoJupyterCapabilities() {
  let quartoJupyter = Deno.env.get("QUARTO_PYTHON");
  if (quartoJupyter) {
    debug(`Checking QUARTO_PYTHON set to '${quartoJupyter}'`);
    // if the path is relative then resolve it
    if (!isAbsolute(quartoJupyter)) {
      const path = await which(quartoJupyter);
      if (path) {
        quartoJupyter = path;
        debug(`Resolved QUARTO_PYTHON to '${quartoJupyter}'`);
      }
    }
    if (existsSync(quartoJupyter)) {
      let quartoJupyterBin: string | undefined = quartoJupyter;
      if (Deno.statSync(quartoJupyter).isDirectory) {
        debug(
          `QUARTO_PYTHON '${quartoJupyter}' is a directory, looking for python binary`,
        );
        const bin = ["python3", "python", "python3.exe", "python.exe"]
          .find((bin) => {
            return existsSync(join(quartoJupyter!, bin));
          });
        if (bin) {
          debug(`Found python binary '${bin}' in QUARTO_PYTHON`);
          quartoJupyterBin = join(quartoJupyter, bin);
        } else {
          quartoJupyterBin = undefined;
        }
      }
      if (quartoJupyterBin) {
        debug(`Checking Jupyter capabilities for '${quartoJupyterBin}'`);
        return getJupyterCapabilities([quartoJupyterBin]);
      }
    } else {
      warnOnce(`Specified QUARTO_PYTHON '${quartoJupyter}' does not exist`);
    }
    warnOnce(
      `No python binary found in specified QUARTO_PYTHON location '${quartoJupyter}'`,
    );
    return undefined;
  } else {
    return undefined;
  }
}

export async function jupyterCapabilitiesNoConda() {
  // if there is an explicit python requested then use it
  const caps = await getQuartoJupyterCapabilities();
  if (caps && !caps.conda) {
    return caps;
  }

  if (isWindows) {
    return await getPyLauncherJupyterCapabilities();
  } else {
    const caps = await getJupyterCapabilities(["python3"]);
    if (caps) {
      if (caps?.conda) {
        return await getJupyterCapabilities(["/usr/local/bin/python3"]) ||
          await getJupyterCapabilities(["/usr/bin/python3"]);
      } else {
        return caps;
      }
    } else {
      return undefined;
    }
  }
}

export function isEnvDir(dir: string) {
  return existsSync(join(dir, "pyvenv.cfg")) ||
    existsSync(join(dir, "conda-meta"));
}

function pyPython() {
  return Deno.env.get("PY_PYTHON");
}

function getPyLauncherJupyterCapabilities() {
  debug("Using 'py.exe' to get Jupyter capabilities");
  return getJupyterCapabilities(["py"], true);
}

async function getJupyterCapabilities(cmd: string[], pyLauncher = false) {
  try {
    const result = await execProcess({
      cmd: cmd[0],
      args: [
        ...cmd.slice(1),
        resourcePath("capabilities/jupyter.py"),
      ],
      stdout: "piped",
      stderr: "piped",
      env: {
        ["PYDEVD_DISABLE_FILE_VALIDATION"]: "1",
      },
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
