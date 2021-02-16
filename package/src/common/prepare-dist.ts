/*
* prepare-dist.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { dirname, join } from "path/mod.ts";
import { copySync, ensureDirSync } from "fs/mod.ts";

import { Configuration } from "../common/config.ts";
import { buildFilter } from "./package-filters.ts";
import { bundle } from "../util/deno.ts";
import { Logger } from "../util/logger.ts";


export async function prepareDist(
  config: Configuration) {
  const log = config.log;

  // Move the supporting files into place
  log.info("\nMoving supporting files")
  supportingFiles(config, log);
  log.info("")

  // Create the deno bundle
  const input = join(config.directoryInfo.src, "quarto.ts");
  const output = join(config.directoryInfo.bin, "quarto.js");
  log.info("\nCreating Deno Bundle");
  log.info(output);
  await bundle(
    input,
    output,
    config,
  );
  log.info("")

  // Inline the LUA Filters and move them into place
  log.info("\nCreating Inlined LUA Filters")
  inlineFilters(config);
  log.info("")
}

function supportingFiles(config: Configuration, log: Logger) {
  // Move information and share resources into place
  const filesToCopy = [
    {
      from: join(config.directoryInfo.root, "COPYING.md"),
      to: join(config.directoryInfo.dist, "COPYING.md"),
    },
    {
      from: join(config.directoryInfo.root, "COPYRIGHT"),
      to: join(config.directoryInfo.dist, "COPYRIGHT"),
    },
    {
      from: join(config.directoryInfo.src, "resources", "html-defaults.lua"),
      to: join(config.directoryInfo.share, "html-defaults.lua"),
    },
    {
      from: join(config.directoryInfo.src, "resources", "rmd"),
      to: join(config.directoryInfo.share, "rmd"),
    },
    {
      from: join(config.directoryInfo.src, "resources", "jupyter"),
      to: join(config.directoryInfo.share, "jupyter"),
    },
    {
      from: join(config.directoryInfo.src, "resources", "formats"),
      to: join(config.directoryInfo.share, "formats")
    }
  ];

  // Gather supporting files
  filesToCopy.forEach((fileToCopy) => {

    const dir = dirname(fileToCopy.to);
    log.info(`Ensuring dir ${dir} exists`);
    ensureDirSync(dir)

    log.info(`Copying ${fileToCopy.from} to ${fileToCopy.to}`);
    copySync(fileToCopy.from, fileToCopy.to, { overwrite: true });
  });
}

function inlineFilters(config: Configuration) {
  config.log.info("Building inlined filters");
  const outDir = join(config.directoryInfo.share, "filters");
  const filtersToInline = ["quarto-pre", "crossref", "layout", "quarto-post"];

  filtersToInline.forEach((filter) => {
    config.log.info(filter);
    buildFilter(
      join(
        config.directoryInfo.src,
        "resources",
        "filters",
        filter,
        `${filter}.lua`,
      ),
      join(outDir, filter, `${filter}.lua`),
      config.log,
    );
  });
}
