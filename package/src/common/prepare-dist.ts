/*
* prepare-dist.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { dirname, join } from "../../../src/deno_ral/path.ts";
import { copySync, ensureDirSync, existsSync } from "../../../src/deno_ral/fs.ts";

import { Configuration } from "../common/config.ts";
import { buildFilter } from "./package-filters.ts";
import { bundle } from "../util/deno.ts";
import { info } from "../../../src/deno_ral/log.ts";
import { buildAssets } from "../../../src/command/dev-call/build-artifacts/cmd.ts";
import { initTreeSitter } from "../../../src/core/schema/deno-init-tree-sitter.ts";
import {
Dependency,
  configureDependency,
  kDependencies,
} from "./dependencies/dependencies.ts";
import { copyQuartoScript } from "./configure.ts";
import { deno } from "./dependencies/deno.ts";
import { buildQuartoPreviewJs } from "./previewjs.ts";

export async function prepareDist(
  config: Configuration,
) {
  // run esbuild
  // copy from resources dir to the 'share' dir (which is resources)
  //   config.directoryInfo.share

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
      if (!(e instanceof Error)) { throw e; }
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

  // Stage typst-gather binary (built by configure.sh)
  // Only stage if the build machine architecture matches the target architecture
  // (cross-compilation is not currently supported)
  const buildArch = Deno.build.arch === "aarch64" ? "aarch64" : "x86_64";
  if (buildArch === config.arch) {
    const typstGatherBinaryName = config.os === "windows" ? "typst-gather.exe" : "typst-gather";
    const typstGatherSrc = join(
      config.directoryInfo.root,
      "package/typst-gather/target/release",
      typstGatherBinaryName,
    );
    if (!existsSync(typstGatherSrc)) {
      throw new Error(
        `typst-gather binary not found at ${typstGatherSrc}\n` +
          "Run ./configure.sh to build it.",
      );
    }
    info("\nStaging typst-gather binary");
    const typstGatherDest = join(targetDir, config.arch, typstGatherBinaryName);
    ensureDirSync(join(targetDir, config.arch));
    copySync(typstGatherSrc, typstGatherDest, { overwrite: true });
    info(`Copied ${typstGatherSrc} to ${typstGatherDest}`);
  } else {
    info(`\nNote: Skipping typst-gather staging (build arch ${buildArch} != target arch ${config.arch})`);
  }

  // build quarto-preview.js
  info("Building Quarto Web UI");
  const result = buildQuartoPreviewJs(config.directoryInfo.src, undefined, true);
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

  // Update extension-build import map for distribution
  info("Updating extension-build import map");
  updateImportMap(config);
  info("");

  // Create the deno bundle
  // const input = join(config.directoryInfo.src, "quarto.ts");
  const output = join(config.directoryInfo.pkgWorking.bin, "quarto.js");
  info("\nCreating Deno Bundle");
  info(output);
  await bundle(
    config,
  );
  info("");

  // Inline the LUA Filters and move them into place
  info("\nCreating Inlined LUA Filters");
  inlineFilters(config);
  info("");

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

  // Copy quarto-types to extension-build directory
  // Note: deno.json and import-map.json are copied by supportingFiles() and
  // import-map.json is then updated by updateImportMap() for distribution
  info("Copying quarto-types.d.ts to extension-build directory");
  const extensionBuildDir = join(
    config.directoryInfo.pkgWorking.share,
    "extension-build",
  );
  copySync(
    join(config.directoryInfo.root, "packages/quarto-types/dist/index.d.ts"),
    join(extensionBuildDir, "quarto-types.d.ts"),
    { overwrite: true },
  );

  // Remove the config directory, if present
  info(`Cleaning config`);
  const configDir = join(config.directoryInfo.dist, "config");
  info(configDir);
  if (existsSync(configDir)) {
    Deno.removeSync(configDir, { recursive: true });
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
  ];
  pathsToClean.forEach((path) => Deno.removeSync(path, { recursive: true }));
}

function updateImportMap(config: Configuration) {
  // Read the import map that was copied from src/resources/extension-build/
  const importMapPath = join(
    config.directoryInfo.pkgWorking.share,
    "extension-build",
    "import-map.json",
  );
  const importMapContent = JSON.parse(Deno.readTextFileSync(importMapPath));

  // Read the source import map to get current Deno std versions
  const sourceImportMapPath = join(config.directoryInfo.src, "import_map.json");
  const sourceImportMap = JSON.parse(Deno.readTextFileSync(sourceImportMapPath));
  const sourceImports = sourceImportMap.imports as Record<string, string>;

  // Update the import map for distribution:
  // 1. Change @quarto/types path from dev (../../../packages/...) to dist (./quarto-types.d.ts)
  // 2. Update all other imports (Deno std versions) from source import map
  const updatedImports: Record<string, string> = {
    "@quarto/types": "./quarto-types.d.ts",
  };

  // Copy all other imports from source, updating versions
  for (const key in importMapContent.imports) {
    if (key !== "@quarto/types") {
      const sourceValue = sourceImports[key];
      if (!sourceValue) {
        throw new Error(
          `Import map key "${key}" not found in source import_map.json`,
        );
      }
      updatedImports[key] = sourceValue;
    }
  }

  importMapContent.imports = updatedImports;

  // Write back the updated import map
  Deno.writeTextFileSync(
    importMapPath,
    JSON.stringify(importMapContent, null, 2) + "\n",
  );
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
    { name: "llms", dir: "llms" },
    { name: "leveloneanalysis", dir: "quarto-internals"}
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
