/*
 * quarto.ts
 *
 * Copyright (C) 2020-2024 Posit Software, PBC
 */

import "./core/deno/monkey-patch.ts";

import { Builtins, CommandClass, Cli } from "npm:clipanion";

import { commands } from "./command/command.ts";
import { addLoggingOptions } from "./core/log.ts";
import { debug, error } from "./deno_ral/log.ts";

import { cleanupSessionTempDir, initSessionTempDir } from "./core/temp.ts";
import { quartoConfig } from "./core/quarto.ts";
import { addProfileOptions } from "./quarto-core/profile.ts";
import { satisfies } from "semver/mod.ts";

import {
  devConfigsEqual,
  readInstalledDevConfig,
  readSourceDevConfig,
  reconfigureQuarto,
} from "./core/devconfig.ts";
import { onCleanup } from "./core/cleanup.ts";

// ensures run handlers are registered
import "./core/run/register.ts";

// ensures language handlers are registered
import "./core/handlers/handlers.ts";

// ensures project types are registered
import "./project/types/register.ts";

// ensures writer formats are registered
import "./format/imports.ts";

import { mainRunner } from "./core/main.ts";

class QuartoCli extends Cli {
    constructor() {
        super({
            binaryLabel: 'Quarto CLI',
            binaryName: 'quarto',
            binaryVersion: quartoConfig.version(),
            enableColors: false,
        });

        [
            ...commands,
            Builtins.HelpCommand

            // TODO: shell completion is not yet supported by clipanion
            //   see https://github.com/arcanis/clipanion/pull/89
            // Builtins.CompletionsCommand
        ].forEach((command) => {
            addLoggingOptions(command);
            addProfileOptions(command);
            this.register(command);
        });
    }

    // value type of registrations is not public, so we have to use any here
    replaceCommands(commandEntries: [CommandClass<any>, any][]) {
        this.registrations.clear();
        commandEntries.forEach(([key, value]) => {
            this.registrations.set(key, value)
        });
    }

    // overridden to hide internal commands in help output
    usage(command: any, opts?: any) {
        if (command) {
            return super.usage(command, opts);
        }

        const allCommands = [...this.registrations.entries()];
        const filteredCommands = allCommands.filter(([{usage}, ]) => usage?.category !== 'internal');

        let helpText;
        try {
            this.replaceCommands(filteredCommands);
            helpText = super.usage();
        } finally {
            this.replaceCommands(allCommands);
        }

        return helpText;
    }
}

const checkVersionRequirement = () => {
  const versionReq = Deno.env.get("QUARTO_VERSION_REQUIREMENT");
  if (versionReq) {
    if (!satisfies(quartoConfig.version(), versionReq)) {
      error(
        `Quarto version ${quartoConfig.version()} does not meet semver requirement ${versionReq}`,
      );
      Deno.exit(1);
    }
  }
};

const checkReconfiguration = async () => {
  // check for need to reconfigure
  if (quartoConfig.isDebug()) {
    const installed = readInstalledDevConfig();
    const source = readSourceDevConfig();
    if (installed == null || !devConfigsEqual(installed, source)) {
      await reconfigureQuarto(installed, source);
      Deno.exit(1);
    }
  }
};

export async function quarto(
  args: string[],
  env?: Record<string, string>,
) {
  await checkReconfiguration();
  checkVersionRequirement();

  debug("Quarto version: " + quartoConfig.version());

  const oldEnv: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(env || {})) {
    const oldV = Deno.env.get(key);
    oldEnv[key] = oldV;
    Deno.env.set(key, value);
  }

  // From here on, we have a temp dir that we need to clean up.
  // The calls to Deno.exit() above are fine, but no further
  // ones should be made
  //
  // init temp dir
  initSessionTempDir();
  onCleanup(cleanupSessionTempDir);

  const quartoCommand = new QuartoCli();
  await quartoCommand.runExit(args, { env });

  for (const [key, value] of Object.entries(oldEnv)) {
    if (value === undefined) {
      Deno.env.delete(key);
    } else {
      Deno.env.set(key, value);
    }
  }
}

if (import.meta.main) {
  await mainRunner(async () => {
    await quarto(Deno.args);
  });
}
