/*
* bootstrap.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { join } from "path/mod.ts";
import { download, unzip } from "../util/utils.ts";
import { Configuration } from "./config.ts";

export async function updateRepoDependencies(config: Configuration) {
  const workingDir = Deno.makeTempDirSync();
  const bsVersion = Deno.env.get("BOOTSTRAP");
  if (!bsVersion) {
    throw new Error(`BOOTSTRAP is not defined`);
  }
  const bsIconVersion = Deno.env.get("BOOTSTRAP_FONT");
  if (!bsIconVersion) {
    throw new Error(`BOOTSTRAP_FONT is not defined`);
  }

  config.log.info("Updating Repo Dependencies:");
  config.log.info(`Boostrap: ${bsVersion}`);
  config.log.info(`Boostrap Icon: ${bsIconVersion}`);

  await updateBootstrapDist(bsVersion, config, workingDir);
  await updateBoostrapIcons(bsIconVersion, config, workingDir);

  // Clean up the temp dir
  Deno.removeSync(workingDir, { recursive: true });

  config.log.info(
    "\n** Done- please commit any files that have been updated. **\n",
  );
}

async function updateBootstrapDist(
  version: string,
  config: Configuration,
  working: string,
) {
  config.log.info("Updating Bootstrap...");

  const dirName = `bootstrap-${version}-dist`;
  const fileName = `${dirName}.zip`;
  const distUrl =
    `https://github.com/twbs/bootstrap/releases/download/v${version}/${fileName}`;
  const zipFile = join(working, fileName);

  await download(distUrl, zipFile);

  await unzip(zipFile, working, config.log);

  const bootstrapResourceDir = join(
    config.directoryInfo.src,
    "resources",
    "formats",
    "html",
    "bootstrap",
    "themes",
    "default",
  );

  ["bootstrap.min.js", "bootstrap.bundle.min.js"]
    .forEach((file) => {
      const from = join(working, dirName, "js", file);
      const to = join(bootstrapResourceDir, file);
      config.log.info(`Copying ${from} to ${to}`);
      Deno.copyFileSync(
        from,
        to,
      );
    });

  ["bootstrap.min.css"]
    .forEach((file) => {
      const from = join(working, dirName, "css", file);
      const to = join(bootstrapResourceDir, file);
      config.log.info(`Copying ${from} to ${to}`);
      Deno.copyFileSync(
        from,
        to,
      );
    });

  config.log.info("Done Updating Bootstrap...\n");
}

async function updateBoostrapIcons(
  version: string,
  config: Configuration,
  working: string,
) {
  config.log.info("Updating Bootstrap Icons...");
  const dirName = `bootstrap-icons-${version}`;
  const fileName = `${dirName}.zip`;
  const distUrl =
    `https://github.com/twbs/icons/releases/download/v${version}/${fileName}`;
  const zipFile = join(working, fileName);

  await download(distUrl, zipFile);

  await unzip(zipFile, working, config.log);

  const bootstrapResourceDir = join(
    config.directoryInfo.src,
    "resources",
    "formats",
    "html",
    "bootstrap",
    "themes",
    "default",
  );

  Deno.copyFileSync(
    join(working, dirName, "fonts", "bootstrap-icons.woff"),
    join(bootstrapResourceDir, "bootstrap-icons.woff"),
  );

  Deno.copyFileSync(
    join(working, dirName, "bootstrap-icons.css"),
    join(bootstrapResourceDir, "bootstrap-icons.css"),
  );
  config.log.info("Done Updating Bootstrap Icons...\n");
}
