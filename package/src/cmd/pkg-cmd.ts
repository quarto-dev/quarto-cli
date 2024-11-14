/*
* pkg-cmd.ts
*
* Copyright (C) 2020-2024 Posit Software, PBC
*
*/
import { Command, Option } from "npm:clipanion";
import { join } from "../../../src/deno_ral/path.ts";

import { printConfiguration } from "../common/config.ts";

import {
  kValidArch,
  kValidOS,
  readConfiguration,
} from "../common/config.ts";

export abstract class PackageCommand extends Command {
  arch = Option.String("-a,--arch", {description: "Architecture for this command (" + kValidArch.join(", ") + ")"});
  os = Option.String("-o,--os", {description: "Operating system for this command (" + kValidOS.join(", ") + ")"});
  version = Option.String("-sv,--set-version", {description: "Version to set when preparing this distribution"});

  get config() {
    return readConfiguration(this.version, this.os, this.arch);
  }

  async execute() {
    // Set up the bin and share environment for any downstream code
    const { directoryInfo } = this.config;
    Deno.env.set("QUARTO_BIN_PATH", directoryInfo.bin);
    Deno.env.set(
        "QUARTO_SHARE_PATH",
        join(directoryInfo.src, "resources"),
    );
    Deno.env.set("QUARTO_DEBUG", "true");

    // Print the configuration
    printConfiguration(this.config);
  }
}
