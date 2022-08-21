/*
* dependencies.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";
import { info } from "log/mod.ts";
import { Configuration } from "../config.ts";

import { dartSass } from "./dartsass.ts";
import { deno_dom } from "./deno_dom.ts";
import { esBuild } from "./esbuild.ts";
import { pandoc } from "./pandoc.ts";
import { archiveUrl } from "../archive-binary-dependencies.ts";

// The list of binary dependencies for Quarto
export const kDependencies = [
  deno_dom(version("DENO_DOM")),
  pandoc(version("PANDOC")),
  dartSass(version("DARTSASS")),
  esBuild(version("ESBUILD")),
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
  "darwin": PlatformDependency;
  "linux": PlatformDependency;
  "windows": PlatformDependency;
}

// Defines an individual binary dependency, specific
// to a Platform (and architecture)
export interface PlatformDependency {
  filename: string;
  url: string;
  configure(path: string): Promise<void>;
}

function version(env: string) {
  const version = Deno.env.get(env);
  if (!version) {
    throw Error(`${env} isn't defined with depedency version`);
  } else {
    return version;
  }
}

export async function configureDependency(
  dependency: Dependency,
  config: Configuration,
) {
  info(`Preparing ${dependency.name}`);
  const archDep = dependency.architectureDependencies[Deno.build.arch];
  if (archDep) {
    const platformDep = archDep[Deno.build.os];
    const vendor = Deno.env.get("QUARTO_VENDOR_BINARIES");
    let targetFile = "";
    if (vendor === undefined || vendor === "true") {
      info(`Downloading ${dependency.name}`);

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
    }

    info(`Configuring ${dependency.name}`);
    await platformDep.configure(targetFile);

    if (targetFile) {
      info(`Cleaning up`);
      Deno.removeSync(targetFile);
    }
  } else {
    throw new Error(
      `The architecture ${Deno.build.arch} is missing the dependency ${dependency.name}`,
    );
  }

  info(`${dependency.name} complete.\n`);
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
