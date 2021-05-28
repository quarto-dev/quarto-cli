/*
* quarto.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { onSignal } from "signal/mod.ts";

import {
  Command,
  CompletionsCommand,
  HelpCommand,
} from "cliffy/command/mod.ts";

import { commands } from "./command/command.ts";
import {
  appendLogOptions,
  cleanupLogger,
  initializeLogger,
  logError,
  logOptions,
} from "./core/log.ts";
import { cleanupSessionTempDir, initSessionTempDir } from "./core/temp.ts";
import { quartoConfig } from "./core/quarto.ts";
import { parse } from "flags/mod.ts";

export async function quarto(
  args: string[],
  cmdHandler?: (command: Command) => Command,
) {
  const quartoCommand = new Command()
    .name("quarto")
    .version(quartoConfig.version() + "\n")
    .description("Quarto CLI")
    .throwErrors();

  commands().forEach((command) => {
    quartoCommand.command(
      command.getName(),
      cmdHandler !== undefined ? cmdHandler(command) : command,
    );
  });

  await initializeLogger(logOptions(parse(args)));

  // init temp dir
  initSessionTempDir();

  await quartoCommand.command("help", new HelpCommand().global())
    .command("completions", new CompletionsCommand()).hidden().parse(args);

  // cleanup
  cleanup();
}

if (import.meta.main) {
  try {
    // install termination signal handlers
    if (Deno.build.os !== "windows") {
      onSignal(Deno.Signal.SIGINT, abend);
      onSignal(Deno.Signal.SIGTERM, abend);
    }
    // run quarto
    await quarto(Deno.args, appendLogOptions);

    // exit
    Deno.exit(0);
  } catch (e) {
    if (e) {
      logError(e);
    }
    abend();
  }
}

function abend() {
  cleanup();
  Deno.exit(1);
}

function cleanup() {
  cleanupSessionTempDir();
  cleanupLogger();
}
