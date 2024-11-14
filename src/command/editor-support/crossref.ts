/*
 * command.ts
 *
 * Copyright (C) 2020-2024 Posit Software, PBC
 */

import { join } from "../../deno_ral/path.ts";
import { readAll } from "../../deno_ral/io.ts";
import { error } from "../../deno_ral/log.ts";
import { encodeBase64 } from "../../deno_ral/encoding.ts";

import { Command, Option } from "npm:clipanion";

import { execProcess } from "../../core/process.ts";
import { pandocBinaryPath, resourcePath } from "../../core/resources.ts";
import { globalTempContext } from "../../core/temp.ts";
import { namespace } from "./namespace.ts";

export class CrossrefCommand extends Command {
  static paths = [[namespace, 'crossref']];

  static usage = Command.Usage({
    category: 'internal',
    description: "Index cross references for content"
  })

  input = Option.String("-i,--input", { description: "Use FILE as input (default: stdin)." });
  output = Option.String("-o,--output", { description: "Write output to FILE (default: stdout)." });

  args = Option.Rest();

  async execute() {
    const getInput = async () => {
      if (this.input) {
        return Deno.readTextFileSync(this.input);
      } else {
        // read input
        const stdinContent = await readAll(Deno.stdin);
        return new TextDecoder().decode(stdinContent);
      }
    };
    const getOutputFile: () => string = () => (this.output || "stdout");

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
    const filterParams = encodeBase64(
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
      undefined, // mergeOutput?: "stderr>stdout" | "stdout>stderr",
      undefined, // stderrFilter?: (output: string) => string,
      undefined, // respectStreams?: boolean,
      5000,
    );

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
  }
}
