/*
* installer.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { join } from "path/mod.ts";

import { Configuration } from "../common/config.ts";
import { ensureDirExists } from "../common/utils.ts";
import { makeTarball } from "../common/tar.ts";

export async function makeInstallerDeb(
  configuration: Configuration
) {

  const log = configuration.log;
  log.info("Building deb package...");
  const workingDir = join(configuration.dirs.out, "working");
  ensureDirExists(workingDir);

  // Debian File
  const debianFile = join(workingDir, "debian-binary");
  const debianSrc = "2.0";
  Deno.writeTextFileSync(debianFile, debianSrc);

  // Target the dist folder into data.tar.gz
  // tar czvf data.tar.gz files

  // Make the src tar
  await makeTarball(
    configuration.dirs.dist,
    join(workingDir, "data.tar.gz"),
    log,
  );

  const val = (name: string, value: string): string => {
    return `${name}: ${value}\n`;
  };

  // Make the control file
  let control = "";
  control = control + val("Package", configuration.pkgConfig.identifier);
  control = control + val("Version", configuration.version);
  control = control + val("Section", "user/text");
  control = control + val("Priority", "optional");
  control = control + val("Maintainer", "RStudio, PBC <quarto@rstudio.org>");
  control = control +
    val(
      "Decscription",
      "A tool for creating reproducible, computable documents.",
    );

  const controlFile = join(workingDir, "control");
  Deno.writeTextFileSync(controlFile, control);

  // Tar the control file
  // Todo install scripts: preinst postinst prerm postrm
  await makeTarball(controlFile, join(workingDir, "control.tar.gz"), log);

  // Remove the control file
  Deno.removeSync(controlFile);

  // Directory should now be:
  // working
  //      debian-binary
  //      control.tar.gz
  //      data.tar.gz

  // ar the file
  // ar -r xxx.deb debian-binary control.tar.gz data.tar.gz

  const arCmd: string[] = [];
  arCmd.push("ar");
  arCmd.push("-r");
  arCmd.push(
    join(configuration.dirs.out, `quarto-${configuration.version}.deb`),
  );
  arCmd.push(join(workingDir, "debian-binary"));
  arCmd.push(join(workingDir, "control.tar.gz"));
  arCmd.push(join(workingDir, "data.tar.gz"));
  const p = Deno.run({
    cmd: arCmd,
  });
  const status = await p.status();
  if (status.code !== 0) {
    throw Error("Failure to make tarball");
  }

  // Remove the control file
  Deno.removeSync(workingDir, { recursive: true });
}
