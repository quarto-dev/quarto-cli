/*
 * cmd.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { Command } from "cliffy/command/mod.ts";
import { crossrefCommand, makeCrossrefCommand } from "./crossref.ts";

export const editorSupportCommand = new Command()
  .name("editor-support")
  .description(
    "Miscellaneous tools to support Quarto editor modes",
  )
  .hidden()
  .command("crossref", crossrefCommand);

export const makeEditorSupportCommand = (env?: Record<string, string>) => {
  return new Command()
    .name("editor-support")
    .description(
      "Miscellaneous tools to support Quarto editor modes",
    )
    .hidden()
    .command("crossref", makeCrossrefCommand(env));
};
