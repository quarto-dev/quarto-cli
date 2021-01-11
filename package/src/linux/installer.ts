/*
* installer.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { join } from "path/mod.ts";
import { copySync, emptyDirSync, ensureDirSync, walk } from "fs/mod.ts";

import { Configuration } from "../common/config.ts";
import { runCmd } from "../util/cmd.ts";
import { makeTarball } from "../util/tar.ts";

export async function makeInstallerDeb(
  configuration: Configuration
) {
  const log = configuration.log;
  log.info("Building deb package...");

  // detect packaging machine architecture
  const result = await runCmd("dpkg-architecture", ["-qDEB_BUILD_ARCH"], log);
  const architecture = (result.status.code === 0 ? result.stdout.trim() : undefined);
  if (!architecture) {
    log.error("Can't detect package architecture.")
    throw new Error("Undetectable architecture. Packaging failed.")
  }
  const packageName = `quarto-${configuration.version}-${architecture}.deb`;
  log.info("Building package " + packageName);

  // Prepare working directory
  const workingDir = join(configuration.directoryInfo.out, "working");
  log.info(`Preparing working directory ${workingDir}`);
  ensureDirSync(workingDir);
  emptyDirSync(workingDir);

  // Copy bin into the proper path in working dir
  const workingBinPath = join(workingDir, "opt", configuration.productName.toLowerCase(), "bin");
  log.info(`Preparing bin directory ${workingBinPath}`);
  copySync(configuration.directoryInfo.bin, workingBinPath, { overwrite: true });

  const workingSharePath = join(workingDir, "opt", configuration.productName.toLowerCase(), "share");
  log.info(`Preparing share directory ${workingSharePath}`);
  copySync(configuration.directoryInfo.share, workingSharePath, { overwrite: true });


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
    configuration.directoryInfo.dist,
    join(workingDir, "data.tar.gz"),
    log,
  );

  const val = (name: string, value: string): string => {
    return `${name}: ${value}\n`;
  };

  // Calculate the install size
  const fileSizes = [];
  for await (const entry of walk(configuration.directoryInfo.dist)) {
    if (entry.isFile) {
      fileSizes.push((await Deno.stat(entry.path)).size);
    }
  }
  const size = fileSizes.reduce((accum, target) => { return accum + target; });

  // Make the control file
  log.info("Creating control file");
  let control = "";
  control = control + val("Package", configuration.productName);
  control = control + val("Version", configuration.version);
  control = control + val("Architecture", architecture);
  control = control + val("Installed-Size", `${Math.round(size / 1024)}`);
  control = control + val("Section", "user/text");
  control = control + val("Priority", "optional");
  control = control + val("Maintainer", "RStudio, PBC <quarto@rstudio.org>");
  control = control + val("Homepage", "https://rstudio.com");
  control = control +
    val(
      "Description",
      "Command line tool for rendering computational markdown documents.",
    );
  log.info(control);


  // Place 
  const debianDir = join(workingDir, "DEBIAN");
  ensureDirSync(debianDir);

  // Write the control file to the DEBIAN directory
  Deno.writeTextFileSync(join(debianDir, "control"), control);

  // copy the install scripts
  log.info("Copying install scripts...")
  copySync(join(configuration.directoryInfo.pkg, "scripts", "linux", "deb"), debianDir, { overwrite: true });

  await runCmd("dpkg-deb",
    [
      "-Z", "gzip",
      "-z", "9",
      "--build",
      workingDir,
      join(configuration.directoryInfo.out, packageName)
    ],
    log);

  // Remove the working directory
  Deno.removeSync(workingDir, { recursive: true });
}