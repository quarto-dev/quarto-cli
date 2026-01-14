/*
* installer.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { join } from "../../../src/deno_ral/path.ts";
import { copySync, emptyDirSync, ensureDirSync, existsSync, walk } from "../../../src/deno_ral/fs.ts";
import { info } from "../../../src/deno_ral/log.ts";
import * as yaml from "../../../src/core/lib/external/js-yaml.js";

import { Configuration } from "../common/config.ts";
import { runCmd } from "../util/cmd.ts";

// Map architecture names between Quarto and package formats
function mapArchitecture(arch: string, format: 'deb' | 'rpm'): string {
  if (format === 'deb') {
    return arch === 'x86_64' ? 'amd64' : 'arm64';
  } else { // rpm
    return arch === 'x86_64' ? 'x86_64' : 'aarch64';
  }
}

// Create nfpm configuration for DEB or RPM packages
async function createNfpmConfig(
  configuration: Configuration,
  format: 'deb' | 'rpm',
  workingDir: string,
) {
  const arch = mapArchitecture(configuration.arch, format);
  const workingBinPath = join(
    workingDir,
    "opt",
    configuration.productName.toLowerCase(),
    "bin",
  );
  const workingSharePath = join(
    workingDir,
    "opt",
    configuration.productName.toLowerCase(),
    "share",
  );

  const contents: any[] = [
    {
      src: workingBinPath,
      dst: "/opt/quarto/bin",
      type: "tree",
    },
    {
      src: workingSharePath,
      dst: "/opt/quarto/share",
      type: "tree",
    },
  ];

  // Add copyright file for DEB packages
  if (format === 'deb') {
    const copyrightFile = join(
      workingDir,
      "usr",
      "share",
      "doc",
      configuration.productName.toLowerCase(),
      "copyright",
    );
    contents.push({
      src: copyrightFile,
      dst: `/usr/share/doc/${configuration.productName.toLowerCase()}/copyright`,
    });
  }

  const config: any = {
    name: configuration.productName.toLowerCase(),
    version: configuration.version,
    arch: arch,
    maintainer: "Posit, PBC <quarto@posit.co>",
    description: "Quarto is an academic, scientific, and technical publishing system built on Pandoc.",
    homepage: "https://github.com/quarto-dev/quarto-cli",
    license: "MIT",

    contents: contents,

    scripts: {
      postinstall: join(configuration.directoryInfo.pkg, "scripts", "linux", format, "postinst"),
      postremove: join(configuration.directoryInfo.pkg, "scripts", "linux", format, "postrm"),
    },

    overrides: {},
  };

  // Format-specific configuration
  if (format === 'deb') {
    config.overrides.deb = {
      recommends: ["unzip"],
    };
    // Add Debian-specific metadata
    config.section = "user/text";
    config.priority = "optional";
  }
  return config;
}

// Build package using nfpm
async function buildPackageWithNfpm(
  configuration: Configuration,
  format: 'deb' | 'rpm',
) {
  const packageExt = format === 'deb' ? 'deb' : 'rpm';
  const arch = mapArchitecture(configuration.arch, format);
  const packageName = `quarto-${configuration.version}-linux-${arch}.${packageExt}`;

  info(`Building ${format.toUpperCase()} package: ${packageName}`);

  // Prepare working directory
  const workingDir = join(configuration.directoryInfo.out, "working");
  info(`Preparing working directory ${workingDir}`);
  ensureDirSync(workingDir);
  emptyDirSync(workingDir);

  // Copy bin and share directories
  const workingBinPath = join(
    workingDir,
    "opt",
    configuration.productName.toLowerCase(),
    "bin",
  );
  info(`Preparing bin directory ${workingBinPath}`);
  copySync(configuration.directoryInfo.pkgWorking.bin, workingBinPath, {
    overwrite: true,
  });

  const workingSharePath = join(
    workingDir,
    "opt",
    configuration.productName.toLowerCase(),
    "share",
  );
  info(`Preparing share directory ${workingSharePath}`);
  copySync(configuration.directoryInfo.pkgWorking.share, workingSharePath, {
    overwrite: true,
  });

  // Create copyright file for DEB packages
  if (format === 'deb') {
    info("Creating copyright file");
    const url = "https://github.com/quarto-dev/quarto-cli";
    const copyrightText = `Format: https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/
Upstream-Name: Quarto
Source: ${url}

Files: *
Copyright: Posit, PBC.
License: MIT`;

    const copyrightDir = join(workingDir, "usr", "share", "doc", configuration.productName.toLowerCase());
    ensureDirSync(copyrightDir);
    Deno.writeTextFileSync(join(copyrightDir, "copyright"), copyrightText);
  }

  // Create nfpm configuration
  const nfpmConfig = await createNfpmConfig(configuration, format, workingDir);
  const configPath = join(configuration.directoryInfo.out, "nfpm.yaml");

  info("Creating nfpm configuration file");
  Deno.writeTextFileSync(configPath, yaml.dump(nfpmConfig));

  // Build package using nfpm (assumes nfpm is installed in PATH)
  const outputPath = join(configuration.directoryInfo.out, packageName);
  await runCmd("nfpm", [
    "package",
    "--config", configPath,
    "--target", outputPath,
    "--packager", format,
  ]);

  info(`Package created: ${outputPath}`);

  // Clean up
  Deno.removeSync(configPath);
  // Optionally remove working directory
  // Deno.removeSync(workingDir, { recursive: true });
}

export async function makeInstallerDeb(
  configuration: Configuration,
) {
  await buildPackageWithNfpm(configuration, 'deb');
}

export async function makeInstallerRpm(
  configuration: Configuration,
) {
  await buildPackageWithNfpm(configuration, 'rpm');
}