/*
* command.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { join } from "path/posix.ts";
import { readAll } from "streams/mod.ts";
import { error } from "log/mod.ts";

import { Command } from "cliffy/command/mod.ts";

import { exitWithCleanup } from "../../core/cleanup.ts";
import { render } from "../render/render-shared.ts";
import { renderServices } from "../render/render-shared.ts";

export const crossrefCommand = new Command()
  .description("Index cross references for content")
  .action(async () => {
    // read input
    const input = await readAll(Deno.stdin);

    // get render services
    const services = renderServices();

    // create directory for indexing and write input into it
    const indexingDir = services.temp.createDir();
    const inputFile = join(indexingDir, "input.qmd");
    Deno.writeFile(inputFile, input);

    // setup index file and input type
    const indexFile = "index.json";
    Deno.env.set("QUARTO_CROSSREF_INDEX_PATH", indexFile);
    Deno.env.set("QUARTO_CROSSREF_INPUT_TYPE", "qmd");

    // render
    const result = await render(inputFile, {
      services,
      progress: false,
      flags: {
        quiet: true,
      },
    });

    if (result.error) {
      error("Error running Pandoc: " + result.error.message);
      exitWithCleanup(1);
    }

    // write back the index
    Deno.stdout.writeSync(Deno.readFileSync(join(indexingDir, indexFile)));
  });
