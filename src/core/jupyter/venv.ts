/*
* venv.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { info } from "log/mod.ts";
import { join } from "path/mod.ts";

import * as colors from "fmt/colors.ts";

import { ld } from "lodash/mod.ts";

import { isWindows } from "../platform.ts";
import { execProcess } from "../process.ts";
import { jupyterCapabilitiesNoConda } from "./capabilities.ts";

export async function jupyterCreateVenv(dir: string, packages?: string[]) {
  const kEnvDir = "env";
  info(`Creating virtual environment at ${colors.bold(kEnvDir + "/")}:`);
  const caps = await jupyterCapabilitiesNoConda();
  if (caps) {
    const executable = caps.pyLauncher ? "py" : caps.executable;
    const result = await execProcess({
      cmd: [executable, "-m", "venv", kEnvDir],
      cwd: dir,
    });
    if (!result.success) {
      throw new Error();
    }
    const pip3 = join(
      dir,
      kEnvDir,
      isWindows() ? "Scripts\\pip.exe" : "bin/pip3",
    );
    packages = ld.uniq(["jupyter"].concat(packages || []));
    const installResult = await execProcess({
      cmd: [pip3, "install", ...packages],
      cwd: dir,
    });
    if (!installResult.success) {
      throw new Error();
    }
  } else {
    throw new Error("Unable to create venv (Non-conda Python 3 not found)");
  }
}
