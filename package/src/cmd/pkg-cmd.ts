/*
* pkg-cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { Command } from "cliffy/command/mod.ts";
import { info } from "log/mod.ts";

import { Configuration, readConfiguration } from "../common/config.ts";

export const kLogLevel = "logLevel";
export const kVersion = "setVersion";

export function packageCommand(run: (config: Configuration) => Promise<void>) {
  return new Command().action(async (args) => {
    const version = args[kVersion];

    const config = readConfiguration(version);
    info("Using configuration:");
    info(config);
    await run(config);
  });
}
