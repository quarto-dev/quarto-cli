/*
 * cmd.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { cwd, writeStdoutSync } from "../../deno_ral/process.ts";
import { Command } from "cliffy/command/mod.ts";

import {
  initState,
  setInitializer,
} from "../../core/lib/yaml-validation/state.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../core/schema/utils.ts";
import { inspectConfig } from "../../inspect/inspect.ts";
import { writeTextFileSync } from "../../deno_ral/fs.ts";

export const inspectCommand = new Command()
  .name("inspect")
  .arguments("[path] [output]")
  .description(
    "Inspect a Quarto project or input path.\n\nInspecting a project returns its config and engines.\n" +
      "Inspecting an input path return its formats, engine, and dependent resources.\n\n" +
      "Emits results of inspection as JSON to output (or stdout if not provided).",
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
  .example(
    "Inspect input path and write to file",
    "quarto inspect document.md output.json",
  )
  .action(
    async (
      // deno-lint-ignore no-explicit-any
      _options: any,
      path?: string,
      output?: string,
    ) => {
      // one-time initialization of yaml validation modules
      setInitializer(initYamlIntelligenceResourcesFromFilesystem);
      await initState();

      path = path || cwd();

      // get the config
      const config = await inspectConfig(path);

      // write using the requisite format
      const outputJson = JSON.stringify(config, undefined, 2);

      if (!output) {
        writeStdoutSync(new TextEncoder().encode(outputJson + "\n"));
      } else {
        writeTextFileSync(output, outputJson + "\n");
      }
    },
  );
