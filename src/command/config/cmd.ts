/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { stringify } from "encoding/yaml.ts";

import { Command } from "cliffy/command/mod.ts";

import { Metadata, projectConfig } from "../../config/metadata.ts";
import { renderContext } from "../render/render.ts";
import { Format } from "../../config/format.ts";

export const configCommand = new Command()
  .name("config")
  .arguments("[path:string]")
  .description(
    "Print the configuration metadata for an input file or project",
  )
  .option(
    "-t, --to <format:string>",
    "Target output format to resolve metadata for",
  )
  .option(
    "--json",
    "Print output as JSON (defaults to YAML)",
  )
  .example(
    "Print project metadata",
    "quarto config myproject",
  )
  .example(
    "Print project metadata as JSON",
    "quarto config myproject --format json",
  )
  .example(
    "Print metadata for input file",
    "quarto config markdown.md",
  )
  // deno-lint-ignore no-explicit-any
  .action(async (options: any, path: string) => {
    // default to current working directory
    path = path || Deno.cwd();

    // print the config
    const stat = Deno.statSync(path);
    // deno-lint-ignore no-explicit-any
    const config: any = stat.isDirectory
      ? projectConfig(path)
      : await fileConfig(path, options.to);
    if (config) {
      // write using the requisite format
      const output = options.json
        ? JSON.stringify(config, undefined, 2)
        : stringify(config, { indent: 2, sortKeys: false });
      Deno.stdout.writeSync(new TextEncoder().encode(output + "\n"));
    } else {
      throw new Error(`No configuration found for path '${path}'`);
    }
  });

async function fileConfig(path: string, to?: string) {
  const context = await renderContext(path, { flags: { to } });
  const metadata = context.format.metadata;
  delete metadata.format;
  return metadata;
}
