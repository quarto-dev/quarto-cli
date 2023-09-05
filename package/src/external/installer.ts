/*
* installer.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { join } from "path/mod.ts";
import { copySync } from "fs/copy.ts";
import { info } from "log/mod.ts";

import { Configuration } from "../common/config.ts";

export async function makeInstallerExternal(
  configuration: Configuration,
) {
  info("Copying Quarto files...");

  // It's expected that the external build tool will set QUARTO_DIST_PATH.
  const workingBinPath = join(configuration.directoryInfo.dist, "bin");
  copySync(configuration.directoryInfo.pkgWorking.bin, workingBinPath, {
    overwrite: true,
  });

  // The assumption here is that you're installing to a shared location. The probability of a namespace conflict is pretty high.
  // Thus, we nest the share contents in a quarto folder. At runtime, the QUARTO_SHARE_PATH env var accounts for this.
  const workingSharePath = join( configuration.directoryInfo.dist, "share", "quarto");
  copySync(configuration.directoryInfo.pkgWorking.share, workingSharePath, {
    overwrite: true,
  });
}
