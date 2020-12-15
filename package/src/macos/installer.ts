/*
* installer.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { dirname, join } from "path/mod.ts";
import { existsSync } from "fs/exists.ts";

import { Configuration } from "../common/config.ts";
import { Logger } from "../common/logger.ts";
import { ensureDirExists } from "../common/utils.ts";

export async function makeInstallerMac(config: Configuration) {
  // Target package
  const outPackage = join(
    config.dirs.out,
    config.pkgConfig.name,
  );

  config.log.info(`Packaging into ${outPackage}`);

  // Clean any existing package
  if (existsSync(outPackage)) {
    Deno.removeSync(outPackage);
  }

  // Make the out dir
  ensureDirExists(dirname(outPackage));

  // Run pkg build
  const pkgCmd: string[] = [];
  pkgCmd.push("pkgbuild");
  pkgCmd.push("--root");
  pkgCmd.push(config.dirs.dist);
  pkgCmd.push("--identifier");
  pkgCmd.push(config.pkgConfig.identifier);
  pkgCmd.push("--version");
  pkgCmd.push(config.version);
  pkgCmd.push(...config.pkgConfig.packageArgs());
  pkgCmd.push("--ownership");
  pkgCmd.push("recommended");
  pkgCmd.push(outPackage);

  config.log.info(pkgCmd);
  const p = Deno.run({
    cmd: pkgCmd,
    stdout: "piped",
    stderr: "piped",
  });
  const status = await p.status();
  const output = new TextDecoder().decode(await p.output());
  const stderr = new TextDecoder().decode(await p.stderrOutput());
  if (status.code !== 0) {
    config.log.error(stderr);
    throw Error(`Failure to build macos installer`);
  } else {
    config.log.info(output);
  }
}

function signPackage(configuration: Configuration, log: Logger) {
}

function signBinaries(configuration: Configuration, log: Logger) {
}
