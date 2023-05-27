/*
 * quarto.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
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
import { debug } from "log/mod.ts";

import { cleanupSessionTempDir, initSessionTempDir } from "./core/temp.ts";
import { removeFlags } from "./core/flags.ts";
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
import { runCommand, runScript } from "./command/run/run.ts";

// ensures run handlers are registered
import "./core/run/register.ts";

// ensures language handlers are registered
import "./core/handlers/handlers.ts";

// ensures project types are registered
import "./project/types/register.ts";

// ensures writer formats are registered
import "./format/imports.ts";

import { kCliffyImplicitCwd } from "./config/constants.ts";
import { lspCommand } from "./command/lsp/cmd.ts";
import { pandocCommand } from "./command/pandoc/cmd.ts";

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
  //
  // we do this via a UUID so that we can detect this happened
  // and issue a warning in the case where the user might
  // be calling render with parameters in incorrect order.
  //
  // see https://github.com/quarto-dev/quarto-cli/issues/3581
  if (
    args.length > 1 &&
    (args[0] === "render" || args[0] === "preview") &&
    args[1].startsWith("-")
  ) {
    args = [args[0], kCliffyImplicitCwd, ...args.slice(1)];
  }

  debug("Quarto version: " + quartoConfig.version());

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

    // initialize profile (remove from args)
    let quartoArgs = [...Deno.args];
    if (setProfileFromArg(args)) {
      const removeArgs = new Map<string, boolean>();
      removeArgs.set("--profile", true);
      quartoArgs = removeFlags(quartoArgs, removeArgs);
    }

    // run quarto
    await quarto(quartoArgs, (cmd) => {
      if (![lspCommand, pandocCommand, runCommand].includes(cmd)) {
        cmd = appendLogOptions(cmd);
        return appendProfileArg(cmd);
      } else {
        return cmd;
      }
    });

    await cleanupLogger();

    // if profiling, wait for 10 seconds before quitting
    if (Deno.env.get("QUARTO_TS_PROFILE") !== undefined) {
      console.log("Program finished. Turn off the Chrome profiler now!");
      console.log("Waiting for 10 seconds ...");
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }

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
