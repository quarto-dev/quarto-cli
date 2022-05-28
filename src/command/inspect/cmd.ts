/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Command } from "cliffy/command/mod.ts";

import {
  initState,
  setInitializer,
} from "../../core/lib/yaml-validation/state.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../core/schema/utils.ts";
import { inspectConfig } from "../../quarto-core/inspect.ts";

export const inspectCommand = new Command()
  .name("inspect")
  .arguments("[path:string]")
  .description(
    "Inspect a Quarto project or input path.\n\nInspecting a project returns its config and engines.\n" +
      "Inspecting an input path return its formats, engine, and dependent resources.\n\n" +
      "Emits results of inspection as JSON to stdout.",
  )
  .hidden()
  .example(
    "Inspect project in current directory",
    "quarto inspect",
  )
  .example(
    "Inspect project in directory",
    "quarto inspect myproject",
  )
  .example(
    "Inspect input path",
    "quarto inspect document.md",
  )
  // deno-lint-ignore no-explicit-any
  .action(async (_options: any, path: string | undefined) => {
    // one-time initialization of yaml validation modules
    setInitializer(initYamlIntelligenceResourcesFromFilesystem);
    await initState();

    path = path || Deno.cwd();

    // get the config
    const config = await inspectConfig(path);

    // write using the requisite format
    const output = JSON.stringify(config, undefined, 2);

    Deno.stdout.writeSync(
      new TextEncoder().encode(output + "\n"),
    );
  });
