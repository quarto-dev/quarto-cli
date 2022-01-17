/*
* quarto.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

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
import { execProcess } from "./core/process.ts";
import { pandocBinaryPath } from "./core/resources.ts";
import {
  devConfigsEqual,
  readInstalledDevConfig,
  readSourceDevConfig,
  reconfigureQuarto,
} from "./core/devconfig.ts";

import { parse } from "flags/mod.ts";
import { runScript } from "./command/run/run.ts";

export async function quarto(
  args: string[],
  cmdHandler?: (command: Command) => Command,
) {
  // check for need to reconfigure
  if (quartoConfig.isDebug()) {
    const installed = readInstalledDevConfig();
    const source = readSourceDevConfig();
    if (installed == null || !devConfigsEqual(installed, source)) {
      await reconfigureQuarto(installed, source);
      Deno.exit(1);
    }
  }

  // passthrough to pandoc
  if (args[0] === "pandoc") {
    const result = await execProcess({
      cmd: [pandocBinaryPath(), ...args.slice(1)],
    });
    Deno.exit(result.code);
  }

  // passthrough to run handlers
  if (args[0] === "run") {
    const result = await runScript(args.slice(1));
    Deno.exit(result.code);
  }

  // inject implicit cwd arg for quarto preview/render whose
  // first argument is a command line parmaeter. this allows
  // us to evade a cliffy cli parsing issue where it requires
  // at least one defined argument to be parsed before it can
  // access undefined arguments.
  if (
    args.length > 1 &&
    (args[0] === "render" || args[0] === "preview") &&
    args[1].startsWith("-")
  ) {
    args = [args[0], Deno.cwd(), ...args.slice(1)];
  }

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

  // init temp dir
  initSessionTempDir();

  await quartoCommand.command("help", new HelpCommand().global())
    .command("completions", new CompletionsCommand()).hidden().parse(args);
}

if (import.meta.main) {
  // we'd like to do this:
  //
  // await mainRunner(() => quarto(Deno.args, appendLogOptions));
  //
  // but it presently causes the bundler to generate bad JS.
  try {
    // install termination signal handlers
    if (Deno.build.os !== "windows") {
      Deno.addSignalListener("SIGINT", abend);
      Deno.addSignalListener("SIGTERM", abend);
    }

    await initializeLogger(logOptions(parse(Deno.args)));

    // run quarto
    await quarto(Deno.args, appendLogOptions);

    await cleanupLogger();

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
}
