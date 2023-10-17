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

export const makeCrossrefCommand = (env?: Record<string, string>) =>
  new Command()
    .description("Index cross references for content")
    .env("QUARTO_CROSSREF_INPUT=<file:string>", "File to index")
    .env("QUARTO_CROSSREF_OUTPUT=<file:string>", "Output file for result")
    .action(async (options) => {
      const getInput = async () => {
        // Cliffy sometimes appears to steal the environment for itself,
        // ignoring changes to Deno.env. This means we need to hack around
        // its env() method ourselves. That is the cause of the mess
        // of env checks below.
        if (options.quartoCrossrefInput !== undefined) {
          return Deno.readTextFileSync(options.quartoCrossrefInput);
        } else if (Deno.env.get("QUARTO_CROSSREF_INPUT") !== undefined) {
          return Deno.readTextFileSync(Deno.env.get("QUARTO_CROSSREF_INPUT")!);
        } else if (env && env["QUARTO_CROSSREF_INPUT"] !== undefined) {
          return Deno.readTextFileSync(env["QUARTO_CROSSREF_INPUT"]);
        } else {
          // read input
          const stdinContent = await readAll(Deno.stdin);
          return new TextDecoder().decode(stdinContent);
        }
      };

      const getOutput: () => string = () => (options.quartoCrossrefOutput ||
        Deno.env.get("QUARTO_CROSSREF_OUTPUT") ||
        env?.["QUARTO_CROSSREF_OUTPUT"] || "stdout");

      const input = await getInput();

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
        resourcePath("filters/qmd-reader.lua"),
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
            ...(env || {}),
          },
          stdout: "piped",
        },
        input,
      );

      // check for error
      if (!result.success) {
        error("Error running Pandoc: " + result.stderr);
        throw new Error(result.stderr);
      }

      const output = getOutput();
      if (output === "stdout") {
        // write back the index
        Deno.stdout.writeSync(Deno.readFileSync(indexFile));
      } else {
        Deno.writeTextFileSync(output, Deno.readTextFileSync(indexFile));
      }
    });

export const crossrefCommand = makeCrossrefCommand();
