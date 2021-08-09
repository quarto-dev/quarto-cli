/*
* compile-quarto-latexmk.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { Command } from "cliffy/command/mod.ts";
import { basename, join } from "path/mod.ts";
import { ensureDirSync } from "fs/mod.ts";
import { info } from "log/mod.ts";

import { Configuration, readConfiguration } from "../common/config.ts";
import { compile, install, updateDenoPath } from "../util/deno.ts";

export function compileQuartoLatexmkCommand() {
  return new Command()
    .name("compile-quarto-latexmk")
    .description("Builds binary for quarto-latexmk")
    .option(
      "-d, --development",
      "Install for local development",
    )
    .option(
      "-t, --target <target:string>",
      "The target architecture for the binary (e.g. x86_64-unknown-linux-gnu, x86_64-pc-windows-msvc, x86_64-apple-darwin, aarch64-apple-darwin)",
      {
        collect: true,
      },
    )
    .option(
      "-v, --version <version:string>",
      "The version number of the compiled executable",
    )
    .option(
      "-n, --name <name:string>",
      "The name of the compiled executable",
    )
    .option(
      "--description <description...:string>",
      "The description of the compiled executable",
    )
    .action((args) => {
      const configuration = readConfiguration();
      info("Using configuration:");
      info(configuration);
      info("");

      if (args.development) {
        installQuartoLatexmk(configuration);
      } else {
        compileQuartoLatexmk(
          configuration,
          args.target,
          args.version || "0.0.9",
          args.name || "quarto-latexmk",
          args.description.join(" ") || "Quarto Latexmk Engine",
        );
      }
    });
}

const kFlags = [
  "--allow-read",
  "--allow-write",
  "--allow-run",
  "--allow-env",
  "--allow-net",
];

export async function installQuartoLatexmk(
  config: Configuration,
) {
  const installPath = await install(
    entryPointPath(config),
    ["-f", ...kFlags],
    config,
  );
  if (installPath) {
    updateDenoPath(installPath, config);
  }
}

export async function compileQuartoLatexmk(
  config: Configuration,
  targets: string[],
  version: string,
  name: string,
  description: string,
) {
  const workingTempDir = Deno.makeTempDirSync();
  try {
    // If target isn't specified, build for whatever the current architecture is
    targets = targets || [Deno.build.target];

    // temporarily update the constants to reflect the provided information
    const metadataPath = metadataFilePath(config);
    info("Using executable info:");
    info(`version: ${version}`);
    info(`name: ${name}`);
    info(`description: ${description}`);

    // Backup a copy of the source
    Deno.copyFileSync(
      metadataPath,
      join(workingTempDir, basename(metadataPath)),
    );

    // Generate the proper constants and compile
    const verRegex = /^(export const kExeVersion = ").*(";)$/gm;
    const nameRegex = /^(export const kExeName = ").*(";)$/gm;
    const descRegex = /^(export const kExeDescription = ").*(";)$/gm;

    let contents = Deno.readTextFileSync(metadataPath);
    contents = contents.replace(verRegex, `$1${version}$2`);
    contents = contents.replace(nameRegex, `$1${name}$2`);
    contents = contents.replace(descRegex, `$1${description}$2`);

    Deno.writeTextFileSync(metadataPath, contents);

    for (const target of targets) {
      const outputName = name || "quarto-latexmk";
      info(`Compiling for ${target}:`);
      const outputDir = join(
        config.directoryInfo.bin,
        outputName,
        target,
      );
      ensureDirSync(outputDir);
      const output = join(outputDir, filename(outputName, target));

      await compile(
        entryPointPath(config),
        output,
        [...kFlags],
        config,
      );
      info(output + "\n");
    }

    // Restore the previously backed up file
    Deno.copyFileSync(
      join(workingTempDir, basename(metadataPath)),
      metadataPath,
    );
  } finally {
    Deno.removeSync(workingTempDir, { recursive: true });
  }
}

function filename(name: string, target: string) {
  if (target.match(/.*windows.*/)) {
    return `${name}.exe`;
  } else {
    return name;
  }
}

function metadataFilePath(config: Configuration) {
  return join(
    config.directoryInfo.src,
    "command",
    "render",
    "latexmk",
    "quarto-latexmk-metadata.ts",
  );
}

function entryPointPath(config: Configuration) {
  return join(
    config.directoryInfo.src,
    "command",
    "render",
    "latexmk",
    "quarto-latexmk.ts",
  );
}
