/*
 * engine-cmd.ts
 *
 * CLI command for accessing engine-specific functionality
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { Command } from "cliffy/command/mod.ts";
import { executionEngine, executionEngines } from "../../execute/engine.ts";
import { initializeProjectContextAndEngines } from "../command-utils.ts";

export const engineCommand = new Command()
  .name("engine")
  .description(
    `Access functionality specific to quarto's different rendering engines.`,
  )
  .stopEarly()
  .arguments("<engine-name:string> [args...:string]")
  .action(async (options, engineName: string, ...args: string[]) => {
    // Initialize project context and register external engines
    await initializeProjectContextAndEngines();

    // Get the engine (now includes external ones)
    const engine = executionEngine(engineName);
    if (!engine) {
      console.error(`Unknown engine: ${engineName}`);
      console.error(
        `Available engines: ${
          executionEngines().map((e) => e.name).join(", ")
        }`,
      );
      Deno.exit(1);
    }

    if (!engine.populateCommand) {
      console.error(`Engine ${engineName} does not support subcommands`);
      Deno.exit(1);
    }

    // Create temporary command and let engine populate it
    const engineSubcommand = new Command()
      .description(
        `Access functionality specific to the ${engineName} rendering engine.`,
      );
    engine.populateCommand(engineSubcommand);

    // Recursively parse remaining arguments
    await engineSubcommand.parse(args);
  });
