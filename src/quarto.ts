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
import { typstBinaryPath } from "./core/typst.ts";
import { exitWithCleanup, onCleanup } from "./core/cleanup.ts";

import { parse } from "flags/mod.ts";
import { runScript } from "./command/run/run.ts";

// ensures run handlers are registered
import "./core/run/register.ts";

// ensures language handlers are registered
import "./core/handlers/handlers.ts";

// ensures project types are registered
import "./project/types/register.ts";

// ensures writer formats are registered
import "./format/imports.ts";

import { kCliffyImplicitCwd } from "./config/constants.ts";
import { mainRunner } from "./core/main.ts";

export async function quarto(
  args: string[],
  cmdHandler?: (command: Command) => Command,
  env?: Record<string, string>,
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
      env,
    });
    Deno.exit(result.code);
  }

  // passthrough to typst
  if (args[0] === "typst") {
    const result = await execProcess({
      cmd: [typstBinaryPath(), ...args.slice(1)],
      env,
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

  const oldEnv: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(env || {})) {
    const oldV = Deno.env.get(key);
    oldEnv[key] = oldV;
    Deno.env.set(key, value);
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

  const promise = quartoCommand.command("help", new HelpCommand().global())
    .command("completions", new CompletionsCommand()).hidden().parse(args);
  for (const [key, value] of Object.entries(oldEnv)) {
    if (value === undefined) {
      Deno.env.delete(key);
    } else {
      Deno.env.set(key, value);
    }
  }

  await promise;
}

if (import.meta.main) {
  await mainRunner(async (args) => {
    // initialize profile (remove from args)
    let quartoArgs = [...Deno.args];
    if (setProfileFromArg(args)) {
      const removeArgs = new Map<string, boolean>();
      removeArgs.set("--profile", true);
      quartoArgs = removeFlags(quartoArgs, removeArgs);
    }

    // run quarto
    await quarto(quartoArgs, (cmd) => {
      cmd = appendLogOptions(cmd);
      return appendProfileArg(cmd);
    });
  });
}
