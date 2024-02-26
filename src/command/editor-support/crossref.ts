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

function parseCrossrefFlags(options: any, args: string[]): {
  input?: string;
  output?: string;
} {
  let input: string | undefined, output: string | undefined;

  // stop early with no input seems wonky in Cliffy so we need to undo the damage here
  // by inspecting partially-parsed input...
  if (options.input && args[0]) {
    input = args.shift();
  } else if (options.output && args[0]) {
    output = args.shift();
  }
  const argsStack = [...args];
  let arg = argsStack.shift();
  while (arg !== undefined) {
    switch (arg) {
      case "-i":
      case "--input":
        arg = argsStack.shift();
        if (arg) {
          input = arg;
        }
        break;

      case "-o":
      case "--output":
        arg = argsStack.shift();
        if (arg) {
          output = arg;
        }
        break;
      default:
        arg = argsStack.shift();
        break;
    }
  }
  return { input, output };
}

const makeCrossrefCommand = () => {
  return new Command()
    .description("Index cross references for content")
    .stopEarly()
    .arguments("[...args]")
    .option(
      "-i, --input",
      "Use FILE as input (default: stdin).",
    )
    .option(
      "-o, --output",
      "Write output to FILE (default: stdout).",
    )
    .action(async (options, ...args: string[]) => {
      const flags = parseCrossrefFlags(options, args);
      const getInput = async () => {
        if (flags.input) {
          return Deno.readTextFileSync(flags.input);
        } else {
          // read input
          const stdinContent = await readAll(Deno.stdin);
          return new TextDecoder().decode(stdinContent);
        }
      };
      const getOutputFile: () => string = () => (flags.output || "stdout");

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
      const result = await execProcess(cmd[0], {
        args: cmd.slice(1),
        cwd: indexingDir,
        env: {
          "QUARTO_FILTER_PARAMS": filterParams,
          "QUARTO_SHARE_PATH": resourcePath(),
        },
        stdout: "piped",
      }, input);

      // check for error
      if (!result.success) {
        error("Error running Pandoc: " + result.stderr);
        throw new Error(result.stderr);
      }

      const outputFile = getOutputFile();
      if (outputFile === "stdout") {
        // write back the index
        Deno.stdout.writeSync(Deno.readFileSync(indexFile));
      } else {
        Deno.writeTextFileSync(outputFile, Deno.readTextFileSync(indexFile));
      }
    });
};

export const crossrefCommand = makeCrossrefCommand();
