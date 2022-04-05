/*
* dependencies.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { dirname, join, SEP } from "path/mod.ts";
import { ensureDirSync, existsSync } from "fs/mod.ts";
import { info, warning } from "log/mod.ts";

import { execProcess } from "../../../src/core/process.ts";
import { expandPath } from "../../../src/core/path.ts";
import {
  createDevConfig,
  writeDevConfig,
} from "../../../src/core/devconfig.ts";

import { Configuration } from "./config.ts";
import {
  Dependency,
  kDependencies,
  PlatformDependency,
} from "./dependencies/dependencies.ts";
import { archiveUrl } from "./archive-binary-dependencies.ts";

export async function configure(
  config: Configuration,
) {
  info("");
  info("******************************************");
  info("Configuring local machine for development:");
  info(` - OS  : ${Deno.build.os}`);
  info(` - Arch: ${Deno.build.arch}`);
  info(` - Cwd : ${Deno.cwd()}`);
  info("");
  info("******************************************");
  info("");

  // Download dependencies
  for (const dependency of kDependencies) {
    info(`Preparing ${dependency.name}`);
    const archDep = dependency.architectureDependencies[Deno.build.arch];
    if (archDep) {
      const platformDep = archDep[Deno.build.os];
      info(`Downloading ${dependency.name}`);

      let targetFile;
      try {
        targetFile = await downloadBinaryDependency(
          dependency,
          platformDep,
          config,
        );
      } catch (error) {
        const msg =
          `Failed to Download ${dependency.name}\nAre you sure that version ${dependency.version} of ${dependency.bucket} has been archived using './quarto-bld archive-bin-deps'?\n${error.message}`;
        throw new Error(msg);
      }

      info(`Configuring ${dependency.name}`);
      await platformDep.configure(targetFile);

      info(`Cleaning up`);
      Deno.removeSync(targetFile);
    } else {
      throw new Error(
        `The architecture ${Deno.build.arch} is missing the dependency ${dependency.name}`,
      );
    }

    info(`${dependency.name} complete.\n`);
  }

  // Move the quarto script into place
  info("Creating Quarto script");
  if (Deno.build.os === "windows") {
    Deno.copyFileSync(
      join(config.directoryInfo.pkg, "scripts", "windows", "quarto.cmd"),
      join(config.directoryInfo.bin, "quarto.cmd"),
    );
  } else {
    Deno.copyFileSync(
      join(config.directoryInfo.pkg, "scripts", "common", "quarto"),
      join(config.directoryInfo.bin, "quarto"),
    );
  }

  // record dev config
  const devConfig = createDevConfig(
    Deno.env.get("DENO") || "",
    Deno.env.get("DENO_DOM") || "",
    Deno.env.get("PANDOC") || "",
    Deno.env.get("DARTSASS") || "",
    Deno.env.get("ESBUILD") || "",
    config.directoryInfo.bin,
  );
  writeDevConfig(devConfig, config.directoryInfo.bin);
  info("");

  if (Deno.build.os !== "windows") {
    info("Creating Quarto Symlink");

    // Set up a symlink (if appropriate)
    const symlinkPaths = [
      "/usr/local/bin/quarto",
      "~/.local/bin/quarto",
      expandPath("~/.local/bin/quarto"),
      "~/bin/quarto",
      expandPath("~/bin/quarto"),
    ];
    const pathRaw = Deno.env.get("PATH");
    const paths: string[] = pathRaw ? pathRaw.split(":") : [];
    console.log(paths);
    const symlinksFiltered = symlinkPaths.filter((path) =>
      paths.includes(dirname(path))
    );

    info(`Found ${symlinksFiltered.length} paths to try.`);

    if (symlinksFiltered.length > 0) {
      for (let i = 0; i < symlinksFiltered.length; i++) {
        info(`> Trying ${symlinkPaths[i]}`);
        const symlinkPath = expandPath(symlinkPaths[i]);

        // Remove existing symlink
        try {
          if (existsSync(symlinkPath)) {
            Deno.removeSync(symlinkPath);
          }
        } catch (error) {
          info(error);
          warning(
            "\n> Failed to remove existing symlink.\n> Did you previously install with sudo? Run 'which quarto' to test which version will be used.",
          );
        }

        // Create new symlink
        try {
          ensureDirSync(dirname(symlinkPath) + SEP);

          Deno.symlinkSync(
            join(config.directoryInfo.bin, "quarto"),
            symlinkPath,
          );

          info(`> Symlink created at ${symlinkPath}`);
          info("> Success");
          // it worked, just move on
          break;
        } catch (_error) {
          info(`> Didn't create symlink at ${symlinkPath}`);
          if (i === symlinksFiltered.length - 1) {
            warning(
              `\n> Please ensure that ${
                join(config.directoryInfo.bin, "quarto")
              } is in your path.`,
            );
          }
        }
      }
    } else {
      // Just warn the user and create a symlink in our last resort
      warning(
        `\n> Please ensure that ${
          join(config.directoryInfo.bin, "quarto")
        } is in your path.`,
      );
    }
  }
}

async function downloadBinaryDependency(
  dependency: Dependency,
  platformDependency: PlatformDependency,
  configuration: Configuration,
) {
  const targetFile = join(
    configuration.directoryInfo.bin,
    "tools",
    platformDependency.filename,
  );
  const dlUrl = archiveUrl(dependency, platformDependency);

  info("Downloading " + dlUrl);
  info("to " + targetFile);
  const response = await fetch(dlUrl);
  if (response.status === 200) {
    const blob = await response.blob();

    const bytes = await blob.arrayBuffer();
    const data = new Uint8Array(bytes);

    Deno.writeFileSync(
      targetFile,
      data,
    );
    return targetFile;
  } else {
    throw new Error(response.statusText);
  }
}

// note that this didn't actually work on windows (it froze and then deno was
// inoperable on the machine until reboot!) so we moved it to script/batch
// files on both platforms)
// deno-lint-ignore no-unused-vars
async function downloadDenoStdLibrary(config: Configuration) {
  const denoBinary = join(config.directoryInfo.bin, "deno");
  const denoStdTs = join(
    config.directoryInfo.pkg,
    "scripts",
    "deno_std",
    "deno_std.ts",
  );

  const denoCacheLock = join(
    config.directoryInfo.pkg,
    "scripts",
    "deno_std",
    "deno_std.lock",
  );
  const denoCacheDir = join(
    config.directoryInfo.src,
    "resources",
    "deno_std",
    "cache",
  );
  ensureDirSync(denoCacheDir);

  info("Updating Deno Stdlib");
  info("");
  await execProcess({
    cmd: [
      denoBinary,
      "cache",
      "--unstable",
      "--lock",
      denoCacheLock,
      denoStdTs,
    ],
    env: {
      DENO_DIR: denoCacheDir,
    },
  });
}
