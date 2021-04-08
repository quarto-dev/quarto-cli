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
  cleanupLogger,
  initializeLogger,
  logError,
  LogOptions,
} from "./core/log.ts";
import { cleanupSessionTempDir, initSessionTempDir } from "./core/temp.ts";
import { quartoConfig } from "./core/quarto.ts";
import { Args, parse } from "flags/mod.ts";

export async function quarto(args: string[]) {
  const quartoCommand = new Command()
    .name("quarto")
    .version(quartoConfig.version())
    .description("Quarto CLI")
    .option(
      "-l, --log <file>",
      "Log to this file",
      {
        global: true,
      },
    )
    .option(
      "-ll, --log-level <level>",
      "Log level (info, warning, error, critical)",
      {
        global: true,
      },
    )
    .option(
      "-lf, --log-format <level>",
      "Log format (plain, json-stream)",
      {
        global: true,
      },
    )
    .option(
      "-q, --quiet",
      "Suppress console output.",
      {
        global: true,
      },
    )
    .throwErrors();

  commands().forEach((command) => {
    quartoCommand.command(command.getName(), command);
  });

  await quartoCommand
    .command("help", new HelpCommand().global())
    .command("completions", new CompletionsCommand()).hidden()
    .parse(args);
}

if (import.meta.main) {
  try {
    // Parse the raw args to read globals and initialize logging
    const args = parse(Deno.args);
    await initializeLogger(logOptions(args));

    // init temp dir
    initSessionTempDir();

    // install termination signal handlers
    onSignal(Deno.Signal.SIGINT, cleanup);
    onSignal(Deno.Signal.SIGTERM, cleanup);

    // run quarto
    await quarto(Deno.args);
  } catch (e) {
    if (e) {
      logError(e);
    }
  } finally {
    cleanup();
  }
}

function cleanup() {
  cleanupSessionTempDir();
  cleanupLogger();
  Deno.exit(1);
}

function logOptions(args: Args) {
  const logOptions: LogOptions = {};
  logOptions.log = args.l || args.log;
  logOptions.level = args.ll || args["log-level"];
  logOptions.quiet = args.q || args.quiet;
  logOptions.format = parseFormat(args.lf || args["log-format"]);
  return logOptions;
}

function parseFormat(format?: string) {
  if (format) {
    format = format.toLowerCase();
    switch (format) {
      case "plain":
      case "json-stream":
        return format;
      default:
        return "plain";
    }
  } else {
    return "plain";
  }
}
