/*
* package.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { parse } from "flags/mod.ts";
import { Command } from "cliffy/command/mod.ts";
import { packageCommand } from "./cmd/pkg-cmd.ts";
import { configure } from "./common/configure.ts";
import { error } from "log/mod.ts";
import { mainRunner } from "../../src/core/main.ts";

import { prepareDist } from "./common/prepare-dist.ts";
import { updateHtmlDepedencies } from "./common/update-html-dependencies.ts";
import { makeInstallerDeb } from "./linux/installer.ts";
import { makeInstallerMac } from "./macos/installer.ts";
import {
  compileQuartoLatexmkCommand,
} from "./common/compile-quarto-latexmk.ts";
import { makeInstallerWindows } from "./windows/installer.ts";

import {
  appendLogOptions,
  cleanupLogger,
  initializeLogger,
  logOptions,
} from "../../src/core/log.ts";
import {
  cycleDependenciesCommand,
  parseSwcLogCommand,
} from "./common/cyclic-dependencies.ts";
import { archiveBinaryDependencies } from "./common/archive-binary-dependencies.ts";

// Core command dispatch
export async function quartoBld(args: string[]) {
  const rootCommand = new Command()
    .name("quarto-bld [command]")
    .version("0.1")
    .description(
      "Utility that implements packaging and distribution of quarto cli",
    )
    .option(
      "-s, --signing-identity=[id:string]",
      "Signing identity to use when signing any files.",
      { global: true },
    )
    .throwErrors();

  getCommands().forEach((command) => {
    rootCommand.command(command.getName(), appendLogOptions(command));
  });

  await rootCommand.parse(args);
}

if (import.meta.main) {
  await mainRunner(() => quartoBld(Deno.args));
}

// Supported package commands
function getCommands() {
  const commands: Command[] = [];
  commands.push(
    packageCommand(configure)
      .name("configure")
      .description(
        "Configures this machine for running developer version of Quarto",
      ),
  );
  commands.push(
    packageCommand(updateHtmlDepedencies)
      .name("update-html-dependencies")
      .description(
        "Updates Bootstrap, themes, and JS/CSS dependencies based upon the version in configuration",
      ),
  );
  commands.push(
    packageCommand(archiveBinaryDependencies)
      .name("archive-bin-deps")
      .description("Downloads and archives our binary dependencies."),
  );
  commands.push(
    packageCommand(prepareDist)
      .name("prepare-dist")
      .description("Prepares the distribution directory for packaging."),
  );
  commands.push(
    packageCommand(makeInstallerMac)
      .name("make-installer-mac")
      .description("Builds Mac OS installer"),
  );
  commands.push(
    packageCommand(makeInstallerDeb)
      .name("make-installer-deb")
      .description("Builds Linux deb installer"),
  );
  commands.push(
    packageCommand(makeInstallerWindows)
      .name("make-installer-win")
      .description("Builds Windows installer"),
  );
  commands.push(
    compileQuartoLatexmkCommand(),
  );
  commands.push(
    cycleDependenciesCommand(),
  );
  commands.push(
    parseSwcLogCommand(),
  );
  return commands;
}
