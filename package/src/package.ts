/*
* quarto.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Command } from "cliffy/command/mod.ts";
import { packageCommand } from "./cmd/pkg-cmd.ts";

import { defaultLogger } from "./common/logger.ts";
import { prepareDist } from "./common/prepare-dist.ts";
import { makeInstallerLinux } from "./linux/installer.ts";
import { makeInstallerMac } from "./macos/installer.ts";


export async function quartoPack(args: string[]) {

    const rootCommand = new Command()
        .name("quarto-pack [command]")
        .version("0.1")
        .description("Utility that implements packaging and distribution of quarto cli")
        .option("-l, --log-level=[level:string]", "Log Level (Info, Warning, or Error)", { global: true })
        .throwErrors();

    getCommands().forEach((command) => {
        rootCommand.command(command.getName(), command);
    });

    await rootCommand
        .parse(args);
}

if (import.meta.main) {
    try {
        await quartoPack(Deno.args);
    } catch (error) {
        if (error) {
            defaultLogger().error(`${error.stack}\n`);
        }
        Deno.exit(1);
    }
}

function getCommands() {
    const commands: Command[] = [];
    commands.push(packageCommand(prepareDist)
        .name("prepare-dist")
        .description("Prepares the distribution directory for packaging."));
    commands.push(packageCommand(makeInstallerMac)
        .name("package-mac")
        .description("Builds Mac OS installer"));
    commands.push(packageCommand(makeInstallerLinux)
        .name("package-linux")
        .description("Builds Linux deb installer"));
    return commands;
}