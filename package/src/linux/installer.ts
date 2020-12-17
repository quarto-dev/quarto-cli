/*
* installer.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { join } from "path/mod.ts";
import { dirname } from "https://deno.land/std@0.80.0/path/win32.ts";

import { Configuration } from "../common/config.ts";
import { runCmd } from "../util/cmd.ts";
import { makeTarball } from "../util/tar.ts";
import { ensureDirExists } from "../util/utils.ts";

export async function makeInstallerDeb(
  configuration: Configuration
) {

  configuration.pkgConfig.name = `quarto-${configuration.version}.deb`;
  const log = configuration.log;
  log.info("Building deb package...");
  const workingDir = join(configuration.dirs.out, "working");
  ensureDirExists(workingDir);

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
  control = control + val("Package", configuration.pkgConfig.identifier);
  control = control + val("Version", configuration.version);
  control = control + val("Architecture", "any");
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
  ensureDirExists(dirname(controlFile));
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

  // Tar the control file
  // Todo install scripts: preinst postinst prerm postrm
  // await makeTarball(controlFile, join(workingDir, "control.tar.gz"), log);

  // Remove the control file
  // Deno.removeSync(controlFile);

  // Directory should now be:
  // working
  //      debian-binary
  //      control
  //      data.tar.gz

  // ar the file
  // ar -r xxx.deb debian-binary control.tar.gz data.tar.gz


  // Remove the control file
//  Deno.removeSync(workingDir, { recursive: true });
}
