/*
* installer.ts
*
* Copyright (C) 2020-2024 Posit Software, PBC
*
*/

import { join } from "../../../src/deno_ral/path.ts";
import { copySync } from "../../../src/deno_ral/fs.ts";
import { info } from "../../../src/deno_ral/log.ts";
import { Command } from "npm:clipanion";

import { Configuration } from "../common/config.ts";
import { PackageCommand } from "../cmd/pkg-cmd.ts";

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

export class MakeInstallerExternalCommand extends PackageCommand {
  static paths = [["make-installer-dir"]];

  static usage = Command.Usage({
    description: "Copies Quarto-only files, omitting dependencies, to specified location (for use in third party packaging)",
  });

  async execute() {
    await super.execute();
    await makeInstallerExternal(this.config)
  }
}
