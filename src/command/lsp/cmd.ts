/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Command } from "cliffy/command/mod.ts";

export const renderCommand = new Command()
  .name("lsp")
  .stopEarly()
  .arguments("[input:string] [...args]")
  .description(
    "Start a Language Server Protocol server.",
  )
  .option(
    "-p, --port",
    "Port for the server to run on.",
  )
  .example(
    "Start an LSP at the current directory",
    "quarto lsp",
  )
  // deno-lint-ignore no-explicit-any require-await
  .action(async (options: any, input?: string, args?: string[]) => {
    args = args || [];

    // remove implicit clean argument (re-injected based on what the user
    // actually passes in flags.ts)
    delete options.clean;

    // if an option got defined then this was mis-parsed as an 'option'
    // rather than an 'arg' because no input was passed. reshuffle
    // things to make them work
    if (Object.keys(options).length === 1) {
      const option = Object.keys(options)[0];
      const optionArg = option.replaceAll(
        /([A-Z])/g,
        (_match: string, p1: string) => `-${p1.toLowerCase()}`,
      );
      if (input) {
        args.unshift(input);
        input = undefined;
      }
      args.unshift("--" + optionArg);
      delete options[option];
    }

    // show help if requested
    if (args.length > 0 && args[0] === "--help") {
      renderCommand.showHelp();
      return;
    }

    // pull inputs out of the beginning of flags
    input = input || ".";
    const inputs = [input];
    const firstPandocArg = args.findIndex((arg) => arg.startsWith("-"));
    if (firstPandocArg !== -1) {
      inputs.push(...args.slice(0, firstPandocArg));
      args = args.slice(firstPandocArg);
    }

    // normalize args (to deal with args like --foo=bar)
    const normalizedArgs = [];
    for (const arg of args) {
      const equalSignIndex = arg.indexOf("=");
      if (equalSignIndex > 0 && arg.startsWith("-")) {
        // Split the arg at the first equal sign
        normalizedArgs.push(arg.slice(0, equalSignIndex));
        normalizedArgs.push(arg.slice(equalSignIndex + 1));
      } else {
        normalizedArgs.push(arg);
      }
    }
    args = normalizedArgs;
  });
