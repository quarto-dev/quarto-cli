/*
* pkg-cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { Command } from "cliffy/command/mod.ts";
import { join } from "path/mod.ts";
import { info } from "log/mod.ts";

import { Configuration, readConfiguration } from "../common/config.ts";

export const kLogLevel = "logLevel";
export const kVersion = "setVersion";

export function packageCommand(run: (config: Configuration) => Promise<void>) {
  return new Command().option(
    "-sv, --set-version=[version:string]",
    "Version to set when preparing this distribution",
    // deno-lint-ignore no-explicit-any
  ).action(async (args: Record<string, any>) => {
    const version = args[kVersion];

    // Read the version and configuration
    const config = readConfiguration(version);

    // Set up the bin and share environment for any downstream code
    Deno.env.set("QUARTO_BIN_PATH", config.directoryInfo.bin);
    Deno.env.set(
      "QUARTO_SHARE_PATH",
      join(config.directoryInfo.src, "resources"),
    );
    Deno.env.set("QUARTO_DEBUG", "true");

    // Run the command
    info("Using configuration:");
    info(config);
    await run(config);
  });
}
