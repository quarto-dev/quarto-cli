/*
* compile-quarto-latexmk.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { Command } from "cliffy/command/mod.ts";
import { join } from "path/mod.ts";
import { ensureDirSync } from "fs/mod.ts";
import { info } from "log/mod.ts";

import { Configuration, readConfiguration } from "../common/config.ts";
import { kVersion } from "../cmd/pkg-cmd.ts";
import { compile, install } from "../util/deno.ts";

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
    .action((args) => {
      const version = args[kVersion];

      const configuration = readConfiguration(version);
      info("Using configuration:");
      info(configuration);
      info("");

      if (args.development) {
        installQuartoLatexmk(configuration);
      } else {
        compileQuartoLatexmk(configuration, args.target);
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

  // Fix up the path to deno
  if (installPath) {
    info("Updating install script deno path");
    const installTxt = Deno.readTextFileSync(installPath);
    const finalTxt = Deno.build.os === "windows"
      ? installTxt.replace(
        /deno.exe /g,
        join(config.directoryInfo.bin, "deno.exe") + " ",
      )
      : installTxt.replace(
        /deno /g,
        join(config.directoryInfo.bin, "deno") + " ",
      );
    Deno.writeTextFileSync(
      installPath,
      finalTxt,
    );
  }
}

export async function compileQuartoLatexmk(
  config: Configuration,
  targets?: string[],
) {
  // If target isn't specified, build for whatever the current architecture is
  targets = targets || [Deno.build.target];

  for (const target of targets) {
    info(`Compiling for ${target}:`);
    const outputDir = join(
      config.directoryInfo.bin,
      "quarto-latexmk",
      target,
    );
    ensureDirSync(outputDir);
    const output = join(outputDir, filename(target));

    await compile(
      entryPointPath(config),
      output,
      [...kFlags, "--lite"],
      config,
    );
    info(output + "\n");
  }
}

function filename(target: string) {
  if (target.match(/.*windows.*/)) {
    return "quarto-latexmk.exe";
  } else {
    return "quarto-latexmk";
  }
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
