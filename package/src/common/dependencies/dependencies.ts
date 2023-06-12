/*
* dependencies.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { join } from "path/mod.ts";
import { info, warning } from "log/mod.ts";
import { PlatformConfiguration } from "../config.ts";

import { dartSass } from "./dartsass.ts";
import { deno_dom } from "./deno_dom.ts";
import { esBuild } from "./esbuild.ts";
import { pandoc } from "./pandoc.ts";
import { archiveUrl } from "../archive-binary-dependencies.ts";
import { typst } from "./typst.ts";

// The list of binary dependencies for Quarto
export const kDependencies = [
  deno_dom(version("DENO_DOM")),
  pandoc(version("PANDOC")),
  dartSass(version("DARTSASS")),
  esBuild(version("ESBUILD")),
  typst(version("TYPST"))
];

// Defines a binary dependency for Quarto
export interface Dependency {
  name: string;
  bucket: string;
  version: string;
  architectureDependencies: Record<
    string,
    ArchitectureDependency
  >;
}

// Defines the specific Platform dependencies for
// a given architecture
export interface ArchitectureDependency {
  "darwin"?: PlatformDependency;
  "linux"?: PlatformDependency;
  "windows"?: PlatformDependency;
}

// Defines an individual binary dependency, specific
// to a Platform (and architecture)
export interface PlatformDependency {
  filename: string;
  url: string;
  configure(config: PlatformConfiguration, path: string): Promise<void>;
}

function version(env: string) {
  const version = Deno.env.get(env);
  if (!version) {
    throw Error(`${env} isn't defined with dependency version`);
  } else {
    return version;
  }
}

export async function configureDependency(
  dependency: Dependency,
  targetDir: string,
  config: PlatformConfiguration,
) {
  info(`Preparing ${dependency.name} (${config.os} - ${config.arch})`);
  let archDep = dependency.architectureDependencies[config.arch];

  // If we're missing some arm64, try the intel versions and rely on rosetta.
  if (config.arch === "aarch64") {
    if (!archDep || !archDep[config.os]) {
      warning("Missing configuration for architecture " + config.arch);
      archDep = dependency.architectureDependencies["x86_64"];
    }
  }
  if (archDep) {
    const platformDep = archDep[config.os];
    const vendor = Deno.env.get("QUARTO_VENDOR_BINARIES");
    let targetFile = "";
    if (platformDep && (vendor === undefined || vendor === "true")) {
      info(`Downloading ${dependency.name}`);

      try {
        targetFile = await downloadBinaryDependency(
          dependency,
          platformDep,
          targetDir,
        );
      } catch (error) {
        const msg =
          `Failed to Download ${dependency.name}\nAre you sure that version ${dependency.version} of ${dependency.bucket} has been archived using './quarto-bld archive-bin-deps'?\n${error.message}`;
        throw new Error(msg);
      }
    }

    if (platformDep) {
      info(`Configuring ${dependency.name}`);
      await platformDep.configure(config, targetFile);
    }

    if (targetFile) {
      info(`Cleaning up`);
      Deno.removeSync(targetFile);
    }
  } else {
    throw new Error(
      `The architecture ${config.arch} is missing the dependency ${dependency.name}`,
    );
  }

  info(`${dependency.name} complete.\n`);
}

async function downloadBinaryDependency(
  dependency: Dependency,
  platformDependency: PlatformDependency,
  targetDir: string,
) {
  const targetFile = join(targetDir, platformDependency.filename);
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
