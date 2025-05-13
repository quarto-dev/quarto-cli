/*
* pkg-cmd.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { Command } from "cliffy/command/mod.ts";
import { join } from "../../../src/deno_ral/path.ts";

import { group } from "../../../src/tools/github.ts";

import { configurationAST, printConfiguration } from "../common/config.ts";

import {
  Configuration,
  kValidArch,
  kValidOS,
  readConfiguration,
} from "../common/config.ts";
import { logPandocJson } from "../../../src/core/log.ts";

export const kLogLevel = "logLevel";
export const kVersion = "setVersion";

export function packageCommand(run: (config: Configuration) => Promise<void>, commandName: string) {
  return new Command().option(
    "-sv, --set-version [version:string]",
    "Version to set when preparing this distribution",
  ).option(
    "-o, --os [os:string]",
    "Operating system for this command (" + kValidOS.join(", ") + ")",
  )
    .option(
      "-a, --arch [arch:string]",
      "Architecture for this command (" + kValidArch.join(", ") + ")",
    )
    // deno-lint-ignore no-explicit-any
    .action(async (args: Record<string, any>) => {
      const version = args[kVersion];
      const os = args["os"];
      const arch = args["arch"];

      // Read the version and configuration
      const config = readConfiguration(version, os, arch);

      // Set up the bin and share environment for any downstream code
      Deno.env.set("QUARTO_BIN_PATH", config.directoryInfo.bin);
      Deno.env.set(
        "QUARTO_SHARE_PATH",
        join(config.directoryInfo.src, "resources"),
      );
      Deno.env.set("QUARTO_DEBUG", "true");

      // Print the configuration
      await group("Configuration info", async () => {
        try {
          await logPandocJson(configurationAST(config));
        } catch (e) {
          printConfiguration(config);
        }
      });

      await group(commandName, async () => {
        // Run the command
        await run(config);
      });
    }).name(commandName);
}
