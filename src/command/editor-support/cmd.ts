/*
 * cmd.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { Command } from "cliffy/command/mod.ts";
import { crossrefCommand } from "./crossref.ts";

export const editorSupportCommand = new Command()
  .name("editor-support")
  .description(
    "Miscellaneous tools to support Quarto editor modes",
  )
  .hidden()
  .command("crossref", crossrefCommand);
