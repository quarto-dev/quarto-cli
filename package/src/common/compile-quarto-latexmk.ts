/*
* compile-quarto-latexmk.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { Command } from "cliffy/command/mod.ts";
import { join } from "path/mod.ts";
import { ensureDirSync } from "fs/mod.ts";

import { Configuration, readConfiguration } from "../common/config.ts";
import { parseLogLevel } from "../util/logger.ts";
import { kLogLevel, kVersion } from "../cmd/pkg-cmd.ts";
import { compile } from "../util/deno.ts";

export function compileQuartoLatexmkCommand() {
  return new Command()
    .name("compile-quarto-latexmk")
    .description("Builds binary for quarto-latexmk")
    .option(
      "-t, --target <target:string>",
      "The target architecture for the binary (e.g. x86_64-unknown-linux-gnu, x86_64-pc-windows-msvc, x86_64-apple-darwin, aarch64-apple-darwin)",
    )
    .action((args, target?: string) => {
      const logLevel = args[kLogLevel];
      const version = args[kVersion];

      const configuration = readConfiguration(parseLogLevel(logLevel), version);
      configuration.log.info("Using configuration:");
      configuration.log.info(configuration);
      configuration.log.info("");

      compileQuartoLatexmk(configuration, target);
    });
}

export async function compileQuartoLatexmk(
  config: Configuration,
  target?: string,
) {
  // If target isn't specified, build for whatever the current architecture is
  target = target || Deno.build.arch;

  const input = join(
    config.directoryInfo.src,
    "command",
    "render",
    "latexmk",
    "quarto-latexmk.ts",
  );

  const outputDir = join(
    config.directoryInfo.bin,
    "quarto-latexmk",
    target,
  );
  ensureDirSync(outputDir);
  const output = join(outputDir, filename());

  const flags: string[] = [
    "--allow-read",
    "--allow-write",
    "--allow-run",
    "--allow-env",
    "--allow-net",
  ];

  await compile(input, output, flags, config);
}

function filename() {
  if (Deno.build.os === "windows") {
    return "quarto-latexmk.exe";
  } else {
    return "quarto-latexmk";
  }
}
