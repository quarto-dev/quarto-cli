/*
 * capabilities.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { warning } from "log/mod.ts";
import { isAbsolute, join } from "path/mod.ts";
import { existsSync } from "fs/mod.ts";

import { isWindows } from "../platform.ts";
import { execProcess } from "../process.ts";
import { resourcePath } from "../resources.ts";
import { readYamlFromString } from "../yaml.ts";
import { which } from "../path.ts";

import { JupyterCapabilities, JupyterKernelspec } from "./types.ts";

// cache capabilities per language
const kNoLanguage = "(none)";
const jupyterCapsCache = new Map<string, JupyterCapabilities>();

export async function jupyterCapabilities(kernelspec?: JupyterKernelspec) {
  const language = kernelspec?.language || kNoLanguage;

  if (!jupyterCapsCache.has(language)) {
    // if we are targeting julia then prefer the julia installed miniconda
    const juliaCaps = await getVerifiedJuliaCondaJupyterCapabilities();
    if (language === "julia" && juliaCaps) {
      jupyterCapsCache.set(language, juliaCaps);
      return juliaCaps;
    }

    // if there is an explicit python requested then use it
    const quartoCaps = await getQuartoJupyterCapabilities();
    if (quartoCaps) {
      jupyterCapsCache.set(language, quartoCaps);
      return quartoCaps;
    }

    // if we are on windows and have PY_PYTHON defined then use the launcher
    if (isWindows() && pyPython()) {
      const pyLauncherCaps = await getPyLauncherJupyterCapabilities();
      if (pyLauncherCaps) {
        jupyterCapsCache.set(language, pyLauncherCaps);
      }
    }

    // default handling (also a fallthrough if launcher didn't work out)
    if (!jupyterCapsCache.has(language)) {
      // look for python from conda (conda doesn't provide python3 on windows or mac)
      const condaCaps = await getJupyterCapabilities(["python"]);
      if (condaCaps?.conda) {
        jupyterCapsCache.set(language, condaCaps);
      } else {
        const caps = isWindows()
          ? await getPyLauncherJupyterCapabilities()
          : await getJupyterCapabilities(["python3"]);
        if (caps) {
          jupyterCapsCache.set(language, caps);
        }
      }

      // if the version we discovered doesn't have jupyter and we have a julia provided
      // jupyter then go ahead and use that
      if (!jupyterCapsCache.get(language)?.jupyter_core && juliaCaps) {
        jupyterCapsCache.set(language, juliaCaps);
      }
    }
  }

  return jupyterCapsCache.get(language);
}

async function getVerifiedJuliaCondaJupyterCapabilities() {
  const home = isWindows() ? Deno.env.get("USERPROFILE") : Deno.env.get("HOME");
  if (home) {
    const bin = isWindows()
      ? ["python3.exe", "python.exe"]
      : [join("bin", "python3"), join("bin", "python")];

    for (const pythonBin of bin) {
      const juliaPython = join(
        home,
        ".julia",
        "conda",
        "3",
        pythonBin,
      );
      if (existsSync(juliaPython)) {
        const caps = await getJupyterCapabilities([juliaPython]);
        if (caps?.jupyter_core) {
          return caps;
        }
      }
    }
  }
}

async function getQuartoJupyterCapabilities() {
  let quartoJupyter = Deno.env.get("QUARTO_PYTHON");
  if (quartoJupyter) {
    // if the path is relative then resolve it
    if (!isAbsolute(quartoJupyter)) {
      const path = await which(quartoJupyter);
      if (path) {
        quartoJupyter = path;
      }
    }
    if (existsSync(quartoJupyter)) {
      let quartoJupyterBin: string | undefined = quartoJupyter;
      if (Deno.statSync(quartoJupyter).isDirectory) {
        const bin = ["python3", "python", "python3.exe", "python.exe"]
          .find((bin) => {
            return existsSync(join(quartoJupyter!, bin));
          });
        if (bin) {
          quartoJupyterBin = join(quartoJupyter, bin);
        } else {
          quartoJupyterBin = undefined;
        }
      }
      if (quartoJupyterBin) {
        return getJupyterCapabilities([quartoJupyterBin]);
      }
    }
    warning(
      "Specified QUARTO_PYTHON '" + quartoJupyter + "' does not exist.",
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

  if (isWindows()) {
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
