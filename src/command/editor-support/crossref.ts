/*
 * command.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { join } from "path/posix.ts";
import { readAll } from "streams/mod.ts";
import { error } from "log/mod.ts";
import { encode as base64Encode } from "encoding/base64.ts";

import { Command } from "cliffy/command/mod.ts";

import { execProcess } from "../../core/process.ts";
import { pandocBinaryPath, resourcePath } from "../../core/resources.ts";
import { globalTempContext } from "../../core/temp.ts";
import { exitWithCleanup } from "../../core/cleanup.ts";

export const crossrefCommand = new Command()
  .description("Index cross references for content")
  .action(async () => {
    // read input
    const stdinContent = await readAll(Deno.stdin);
    const input = new TextDecoder().decode(stdinContent);

    // create directory for indexing and write input into it
    const indexingDir = globalTempContext().createDir();

    // setup index file and input type
    const indexFile = join(indexingDir, "index.json");
    Deno.env.set("QUARTO_CROSSREF_INDEX_PATH", indexFile);
    Deno.env.set("QUARTO_CROSSREF_INPUT_TYPE", "qmd");

    // build command
    const cmd = [pandocBinaryPath(), "+RTS", "-K512m", "-RTS"];
    cmd.push(...[
      "--from",
      "markdown",
      "--to",
      "native",
      "--data-dir",
      resourcePath("pandoc/datadir"),
      "--lua-filter",
      resourcePath("filters/quarto-init/quarto-init.lua"),
      "--lua-filter",
      resourcePath("filters/crossref/crossref.lua"),
    ]);

    // create filter params
    const filterParams = base64Encode(
      JSON.stringify({
        ["crossref-index-file"]: "index.json",
        ["crossref-input-type"]: "qmd",
      }),
    );

    // run pandoc
    const result = await execProcess(
      {
        cmd,
        cwd: indexingDir,
        env: {
          "QUARTO_FILTER_PARAMS": filterParams,
          "QUARTO_SHARE_PATH": resourcePath(),
        },
        stdout: "piped",
      },
      input,
    );

    // check for error
    if (!result.success) {
      error("Error running Pandoc: " + result.stderr);
      exitWithCleanup(1);
    }

    // write back the index
    Deno.stdout.writeSync(Deno.readFileSync(indexFile));
  });
