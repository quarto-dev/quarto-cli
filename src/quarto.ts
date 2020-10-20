/*
* quarto.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
* Unless you have received this program directly from RStudio pursuant
* to the terms of a commercial license agreement with RStudio, then
* this program is licensed to you under the terms of version 3 of the
* GNU General Public License. This program is distributed WITHOUT
* ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
* MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
* GPL (http://www.gnu.org/licenses/gpl-3.0.txt) for more details.
*
*/

import {
  Command,
  CompletionsCommand,
  HelpCommand,
} from "cliffy/command/mod.ts";

import { commands } from "./command/command.ts";
import { logError } from "./core/log.ts";

export async function quarto(args: string[]) {
  const quartoCommand = new Command()
    .name("quarto")
    .version("0.1")
    .description("Quarto CLI")
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
    await quarto(Deno.args);
  } catch (error) {
    if (error) {
      logError(`${error.stack}\n${error.toString()}`);
    }
    Deno.exit(1);
  }
}
