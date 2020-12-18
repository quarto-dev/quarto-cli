/*
* installer.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { dirname, join } from "path/mod.ts";
import { copySync, emptyDirSync, ensureDirSync } from "fs/mod.ts";

import { Configuration } from "../common/config.ts";
import { runCmd } from "../util/cmd.ts";
import { makeTarball } from "../util/tar.ts";

export async function makeInstallerDeb(
  configuration: Configuration
) {
  const log = configuration.log;
  log.info("Building deb package...");

  // Move bin directory to 
  // working/opt/quarto/bin/*
  // share to
  // working/opt/quarto/share/*

  // detect packaging machine architecture
  const result = await runCmd("dpkg-architecture", ["-qDEB_BUILD_ARCH"], log);
  const architecture = (result.status.code === 0 ? result.stdout.trim() : undefined);
  if (!architecture) {
    log.error("Can't detect package architecture.")
    throw new Error("Undetectable architecture. Packaging failed.")
  }
  configuration.pkgConfig.name = `quarto_${configuration.version}_${architecture}.deb`;

  // Prepare working directory
  const workingDir = join(configuration.dirs.out, "working");
  log.info(`Preparing working directory ${workingDir}`);
  ensureDirSync(workingDir);
  emptyDirSync(workingDir);

  // Copy bin into the proper path in working dir
  const workingBinPath = join(workingDir, "opt", configuration.productname, "bin");
  log.info(`Preparing bin directory ${workingBinPath}`);
  copySync(configuration.dirs.bin, workingBinPath, { overwrite: true });

  const workingSharePath = join(workingDir, "opt", configuration.productname, "share");
  log.info(`Preparing share directory ${workingSharePath}`);
  copySync(configuration.dirs.share, workingSharePath, { overwrite: true });

 
  // Debian File
  log.info("writing debian-binary")
  const debianFile = join(workingDir, "debian-binary");
  const debianSrc = "2.0";
  Deno.writeTextFileSync(debianFile, debianSrc);

  // Target the dist folder into data.tar.gz
  // tar czvf data.tar.gz files

  // Make the src tar
  log.info("creating data tar");
  await makeTarball(
    configuration.dirs.dist,
    join(workingDir, "data.tar.gz"),
    log,
  );

  const val = (name: string, value: string): string => {
    return `${name}: ${value}\n`;
  };

  // Make the control file
  log.info("Creating control file");
  let control = "";
  control = control + val("Package", configuration.productname);
  control = control + val("Version", configuration.version);
  control = control + val("Architecture", architecture);
  control = control + val("Section", "user/text");
  control = control + val("Priority", "optional");
  control = control + val("Maintainer", "RStudio, PBC <quarto@rstudio.org>");
  control = control +
    val(
      "Description",
      "Command line tool for executing computable markdown documents.",
    );
  log.info(control);
  const controlFile = join(workingDir, "DEBIAN", "control");
  ensureDirSync(dirname(controlFile));
  Deno.writeTextFileSync(controlFile, control);

  await runCmd("dpkg-deb", 
                [
                  "-Z", "gzip", 
                  "-z", "9", 
                  "--build", 
                  workingDir, 
                  join(configuration.dirs.out, configuration.pkgConfig.name)
                ], 
                log);

  // Remove the working directory
  Deno.removeSync(workingDir, { recursive: true });
}
