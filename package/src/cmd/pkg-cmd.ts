/*
* pkg-cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { Command } from "cliffy/command/mod.ts";

import { Configuration, readConfiguration } from "../common/config.ts";
import { parseLogLevel } from "../util/logger.ts";

const kLogLevel = "logLevel";
const kVersion = "setVersion";

export function packageCommand(run: (config: Configuration) => void) {
  return new Command().action((args) => {
    const logLevel = args[kLogLevel];
    const version = args[kVersion];

    const config = readConfiguration(parseLogLevel(logLevel), version);
    config.log.info("Using configuration:");
    config.log.info(config);
    config.log.info("");

    run(config);
  });
}
