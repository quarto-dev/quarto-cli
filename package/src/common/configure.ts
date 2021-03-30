/*
* dependencies.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { join } from "path/mod.ts";

import { Configuration } from "./config.ts";
import { dependencies, PlatformDependency } from "./dependencies.ts";

export async function configure(
  config: Configuration,
) {
  const log = config.log;

  log.info("Configuring local machine for development");
  for (const dependency of dependencies(config)) {
    log.info("Configuring " + dependency.name);
    const platformDep = dependency[Deno.build.os];
    if (platformDep) {
      const targetFile = await downloadBinaryDependency(platformDep, config);
      await platformDep.configure(targetFile);
      Deno.removeSync(targetFile);
    }
  }
}

async function downloadBinaryDependency(
  dependency: PlatformDependency,
  configuration: Configuration,
) {
  const targetFile = join(configuration.directoryInfo.bin, dependency.filename);

  configuration.log.info("Downloading " + dependency.url);
  configuration.log.info("to " + targetFile);
  const response = await fetch(dependency.url);
  const blob = await response.blob();

  const bytes = await blob.arrayBuffer();
  const data = new Uint8Array(bytes);

  Deno.writeFileSync(
    targetFile,
    data,
  );
  return targetFile;
}
