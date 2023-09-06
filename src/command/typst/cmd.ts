/*
 * typst.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { Command } from "cliffy/command/command.ts";

// typst 'command' (this is a fake command that is here just for docs,
// the actual processing of 'run' bypasses cliffy entirely)
export const typstCommand = new Command()
  .name("typst")
  .stopEarly()
  .arguments("[...args]")
  .description(
    "Run the version of Typst embedded within Quarto.\n\n" +
      "You can pass arbitrary command line arguments to quarto typst (they will\n" +
      "be passed through unmodified to Typst)",
  )
  .example(
    "Compile Typst to PDF",
    "quarto typst compile document.typ",
  )
  .example(
    "List all discovered fonts in system and custom font paths",
    "quarto typst fonts",
  );
