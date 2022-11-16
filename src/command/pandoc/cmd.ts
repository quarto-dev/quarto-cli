/*
* pandoc.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { Command } from "cliffy/command/command.ts";

// pandoc 'command' (this is a fake command that is here just for docs,
// the actual processing of 'run' bypasses cliffy entirely)
export const pandocCommand = new Command()
  .name("pandoc")
  .stopEarly()
  .arguments("[...args]")
  .description(
    "Run the version of Pandoc embedded within Quarto.\n\n" +
      "You can pass arbitrary command line arguments to quarto pandoc (they will\n" +
      "be passed through unmodified to Pandoc)",
  )
  .example(
    "Render markdown to HTML",
    "quarto pandoc document.md --to html --output document.html",
  )
  .example(
    "List Pandoc output formats",
    "quarto pandoc --list-output-formats",
  );
