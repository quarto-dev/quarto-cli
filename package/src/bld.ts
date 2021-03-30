/*
* package.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Command } from "cliffy/command/mod.ts";
import { packageCommand } from "./cmd/pkg-cmd.ts";
import { configure } from "./common/configure.ts";

import { prepareDist } from "./common/prepare-dist.ts";
import { updateRepoDependencies } from "./common/update-repo-dependencies.ts";
import { makeInstallerDeb } from "./linux/installer.ts";
import { makeInstallerMac } from "./macos/installer.ts";
import { defaultLogger } from "./util/logger.ts";
import { makeInstallerWindows } from "./windows/installer.ts";

// Core command dispatch
export async function quartoBld(args: string[]) {
  const rootCommand = new Command()
    .name("quarto-bld [command]")
    .version("0.1")
    .description(
      "Utility that implements packaging and distribution of quarto cli",
    )
    .option(
      "-l, --log-level=[level:string]",
      "Log Level (info, warning, or error)",
      { global: true },
    )
    .option(
      "-s, --signing-identity=[id:string]",
      "Signing identity to use when signing any files.",
      { global: true },
    )
    .throwErrors();

  getCommands().forEach((command) => {
    rootCommand.command(command.getName(), command);
  });

  await rootCommand
    .parse(args);
}

if (import.meta.main) {
  try {
    await quartoBld(Deno.args);
  } catch (error) {
    if (error) {
      defaultLogger().error(`${error.stack}\n`);
    }
    Deno.exit(1);
  }
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
    packageCommand(updateRepoDependencies)
      .name("update-repo-deps")
      .description("Updates Bootstrap based upon the version in configuration"),
  );
  commands.push(
    packageCommand(prepareDist)
      .name("prepare-dist")
      .description("Prepares the distribution directory for packaging.")
      .option(
        "-sv, --set-version=[version:string]",
        "Version to set when preparing this distribution",
      ),
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
  return commands;
}
