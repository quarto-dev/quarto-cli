/*
* quarto.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import "./core/deno/monkey-patch.ts";

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
import { appendProfileArg, setProfileFromArg } from "./quarto-core/profile.ts";

import {
  devConfigsEqual,
  readInstalledDevConfig,
  readSourceDevConfig,
  reconfigureQuarto,
} from "./core/devconfig.ts";
import { exitWithCleanup, onCleanup } from "./core/cleanup.ts";

import { parse } from "flags/mod.ts";
import { runScript } from "./command/run/run.ts";

// ensures run handlers are registered
import "./core/run/register.ts";

// ensures language handlers are registered
import "./core/handlers/handlers.ts";

// ensures project types are registered
import "./project/types/register.ts";

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
  if (args[0] === "pandoc" && args[1] !== "help") {
    const result = await execProcess({
      cmd: [pandocBinaryPath(), ...args.slice(1)],
    });
    Deno.exit(result.code);
  }

  // passthrough to run handlers
  if (args[0] === "run" && args[1] !== "help" && args[1] !== "--help") {
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
    .help({ colors: false })
    .version(quartoConfig.version() + "\n")
    .description("Quarto CLI")
    .throwErrors();

  commands().forEach((command) => {
    // turn off colors
    command.help({ colors: false });
    quartoCommand.command(
      command.getName(),
      cmdHandler !== undefined ? cmdHandler(command) : command,
    );
  });

  // init temp dir
  initSessionTempDir();
  onCleanup(cleanupSessionTempDir);

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

    // parse args
    const args = parse(Deno.args);

    // initialize logger
    await initializeLogger(logOptions(args));

    // initialize profile
    setProfileFromArg(args);

    // run quarto
    await quarto(Deno.args, (cmd) => {
      cmd = appendLogOptions(cmd);
      return appendProfileArg(cmd);
    });

    await cleanupLogger();

    // exit
    exitWithCleanup(0);
  } catch (e) {
    if (e) {
      logError(e);
    }
    abend();
  }
}

function abend() {
  exitWithCleanup(1);
}
