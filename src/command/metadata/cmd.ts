/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { stringify } from "encoding/yaml.ts";

import { Command } from "cliffy/command/mod.ts";

import { renderContexts } from "../render/render.ts";
import { projectMetadata } from "../../config/project.ts";
import { Format } from "../../config/format.ts";

export const metadataCommand = new Command()
  .name("metadata")
  .arguments("[path:string]")
  .description(
    "Print the metadata for an input file or project",
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
    "quarto metadata myproject",
  )
  .example(
    "Print project metadata as JSON",
    "quarto metadata myproject --format json",
  )
  .example(
    "Print metadata for input file",
    "quarto metadata markdown.md",
  )
  // deno-lint-ignore no-explicit-any
  .action(async (options: any, path: string) => {
    // default to current working directory
    path = path || Deno.cwd();

    // print the config
    const stat = Deno.statSync(path);
    // deno-lint-ignore no-explicit-any
    const config: any = stat.isDirectory
      ? projectMetadata(path)
      : await fileMetadata(path, options.to);
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

async function fileMetadata(path: string, to = "all") {
  const contexts = await renderContexts(path, { flags: { to } });
  const formats: Record<string, Format> = {};
  Object.keys(contexts).forEach((context) => {
    const format = contexts[context].format;
    delete format.metadata.format;
    formats[context] = format;
  });
  return formats;
}
