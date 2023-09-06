/*
* prepare-dist.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { dirname, join } from "path/mod.ts";
import { ensureDirSync, existsSync } from "fs/mod.ts";
import { copySync } from "fs/copy.ts";

import { Configuration } from "../common/config.ts";
import { buildFilter } from "./package-filters.ts";
import { bundle } from "../util/deno.ts";
import { info } from "log/mod.ts";
import { buildAssets } from "../../../src/command/build-js/cmd.ts";
import { initTreeSitter } from "../../../src/core/schema/deno-init-tree-sitter.ts";
import {
Dependency,
  configureDependency,
  kDependencies,
} from "./dependencies/dependencies.ts";
import { copyPandocAliasScript, copyQuartoScript } from "./configure.ts";
import { deno } from "./dependencies/deno.ts";
import { buildQuartoPreviewJs } from "../../../src/core/previewjs.ts";

export async function prepareDist(
  config: Configuration,
) {
  // run esbuild
  // copy from resources dir to the 'share' dir (which is resources)
  //   config.directoryInfo.share

  // FIXME holding off on prepareDist building assets until we fix
  // this issue: https://github.com/quarto-dev/quarto-cli/runs/4229822735?check_suite_focus=true

  // Moving appropriate binaries into place

  // Get each dependency extracted into the 'bin' folder
  // Download dependencies

  // Ensure that the pkgWorkingDir is clean
  if (existsSync(config.directoryInfo.pkgWorking.root)) {
    Deno.removeSync(config.directoryInfo.pkgWorking.root, { recursive: true });
  }

  // Ensure that the working directory exists
  ensureDirSync(config.directoryInfo.pkgWorking.bin);
  ensureDirSync(config.directoryInfo.pkgWorking.share);
  const toolsDir = join(
    config.directoryInfo.pkgWorking.bin,
    "tools",
  );
  ensureDirSync(toolsDir);

  // binary tools dir
  const targetDir = join(
    config.directoryInfo.pkgWorking.bin,
    "tools",
  );

  // Function to wrap architecture specific configuration
  const configArchDependency = async (dep: Dependency, 
    dir: string,
    config: Configuration) => {
    if (config.os === "darwin") {
      // add a secondary config specifically for Mac
      await configureDependency(dep, dir, {
        os: config.os,
        arch: "aarch64",
      });

      await configureDependency(dep, dir, {
        os: config.os,
        arch: "x86_64",
      });
    } else {
      await configureDependency(dep, targetDir, config);
    }
  }

  // Download Deno
  const denoVersion = Deno.env.get("DENO");
  if (denoVersion) {
    const denoDependency = deno(denoVersion);
    await configArchDependency(denoDependency, targetDir, config)
  }

  // Download the dependencies
  for (const dependency of kDependencies) {
    try {
      await configArchDependency(dependency, targetDir, config)
    } catch (e) {
      if (
        e.message ===
          "The architecture aarch64 is missing the dependency deno_dom"
      ) {
        info("\nIgnoring deno_dom dependency on Apple Silicon");
        continue;
      } else {
        throw e;
      }
    }
  }

  // build quarto-preview.js
  info("Building Quarto Web UI");
  const result = buildQuartoPreviewJs(config.directoryInfo.src);
  if (!result.success) {
    throw new Error();
  }
  

  // Place the quarto sciprt
  // Move the quarto script into place
  info("Moving Quarto script");
  copyQuartoScript(config, config.directoryInfo.pkgWorking.bin);

  // Move the supporting files into place
  info("\nMoving supporting files");
  supportingFiles(config);
  info("");

  // Create the deno bundle
  const input = join(config.directoryInfo.src, "quarto.ts");
  const output = join(config.directoryInfo.pkgWorking.bin, "quarto.js");
  info("\nCreating Deno Bundle");
  info(output);
  await bundle(
    input,
    output,
    config,
  );
  info("");

  // Inline the LUA Filters and move them into place
  info("\nCreating Inlined LUA Filters");
  inlineFilters(config);
  info("");

  // Appease the bundler testing by patching the bad version from `configuration`
  if (config.version.split(".").length === 2) {
    config.version = `${config.version}.1`;
  }

  // Write a version file to share
  info(`Writing version: ${config.version}`);
  Deno.writeTextFileSync(
    join(config.directoryInfo.pkgWorking.share, "version"),
    config.version,
  );
  info("");

  info("\nBuilding JS assets");
  await initTreeSitter();
  await buildAssets();
  const buildAssetFiles = [
    "formats/html/ojs/quarto-ojs-runtime.js",
    "editor/tools/yaml/yaml-intelligence-resources.json",
    "editor/tools/yaml/web-worker.js",
    "editor/tools/yaml/yaml.js",
  ];
  for (const file of buildAssetFiles) {
    copySync(
      join(config.directoryInfo.src, "resources", file),
      join(config.directoryInfo.pkgWorking.share, file),
      { overwrite: true },
    );
  }

  // Remove the config directory, if present
  info(`Cleaning config`);
  const configDir = join(config.directoryInfo.dist, "config");
  info(configDir);
  if (existsSync(configDir)) {
    Deno.removeSync(configDir, {
      recursive: true,
    });
  }

  info("");
}

function supportingFiles(config: Configuration) {
  // Move information and share resources into place
  const filesToCopy = [
    {
      from: join(config.directoryInfo.root, "COPYING.md"),
      to: join(config.directoryInfo.pkgWorking.share, "COPYING.md"),
    },
    {
      from: join(config.directoryInfo.root, "COPYRIGHT"),
      to: join(config.directoryInfo.pkgWorking.share, "COPYRIGHT"),
    },
    {
      from: join(config.directoryInfo.src, "resources"),
      to: config.directoryInfo.pkgWorking.share,
    },
    {
      from: join(config.directoryInfo.src, "resources", "vendor"),
      to: join(config.directoryInfo.pkgWorking.bin, "vendor"),
    },
  ];

  // Gather supporting files
  filesToCopy.forEach((fileToCopy) => {
    const dir = dirname(fileToCopy.to);
    info(`Ensuring dir ${dir} exists`);
    ensureDirSync(dir);

    info(`Copying ${fileToCopy.from} to ${fileToCopy.to}`);
    copySync(fileToCopy.from, fileToCopy.to, { overwrite: true });
  });

  // Cleanup the filters directory, which contains filter source that will be
  // compiled later
  const pathsToClean = [
    join(config.directoryInfo.pkgWorking.share, "filters"),
    join(config.directoryInfo.pkgWorking.share, "vendor"),
  ];
  pathsToClean.forEach((path) => Deno.removeSync(path, { recursive: true }));
}

interface Filter {
  // The name of the filter (the LUA file and perhaps the directory)
  name: string;

  // An optional name of the directory, if it is not the name of the LUA filter
  dir?: string;
}

function inlineFilters(config: Configuration) {
  info("Building inlined filters");
  const outDir = join(config.directoryInfo.pkgWorking.share, "filters");
  const filtersToInline: Filter[] = [
    { name: "main", dir: "." },
    { name: "pagebreak", dir: "rmarkdown" },
    { name: "quarto-init" },
    { name: "crossref" },
    { name: "customwriter" },
    { name: "qmd-reader", dir: "." },
  ];

  filtersToInline.forEach((filter) => {
    info(filter);
    buildFilter(
      join(
        config.directoryInfo.src,
        "resources",
        "filters",
        filter.dir || filter.name,
        `${filter.name}.lua`,
      ),
      join(outDir, filter.dir || filter.name, `${filter.name}.lua`),
    );
  });

  const modules = "modules";
  const modulesIn = join(
    config.directoryInfo.src,
    "resources",
    "filters", modules);
  const modulesOut = join(outDir, modules);

  // move the modules directory
  copySync(modulesIn, modulesOut)
  

}
