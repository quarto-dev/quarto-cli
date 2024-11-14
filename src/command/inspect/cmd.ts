/*
 * cmd.ts
 *
 * Copyright (C) 2020-2024 Posit Software, PBC
 */

import { Command, Option } from "npm:clipanion";

import { initState, setInitializer, } from "../../core/lib/yaml-validation/state.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../core/schema/utils.ts";
import { inspectConfig } from "../../quarto-core/inspect.ts";

export class InspectCommand extends Command {
  static name = 'inspect';
  static paths = [[InspectCommand.name]];

  static usage = Command.Usage({
    category: 'internal',
    description: "Inspect a Quarto project or input path.\n\nInspecting a project returns its config and engines.\n" +
        "Inspecting an input path return its formats, engine, and dependent resources.\n\n" +
        "Emits results of inspection as JSON to output (or stdout if not provided).",
    examples: [
      [
        "Inspect project in current directory",
        `$0 ${InspectCommand.name}`,
      ], [
        "Inspect project in directory",
        `$0 ${InspectCommand.name} myproject`,
      ], [
        "Inspect input path",
        `$0 ${InspectCommand.name} document.md`,
      ], [
        "Inspect input path and write to file",
        `$0 ${InspectCommand.name} document.md output.json`,
      ]
    ]
  })

  path_ = Option.String({ required: false });
  output = Option.String({ required: false });

  async execute() {
    // one-time initialization of yaml validation modules
    setInitializer(initYamlIntelligenceResourcesFromFilesystem);
    await initState();

    this.path_ = this.path_ || Deno.cwd();

    // get the config
    const config = await inspectConfig(this.path_);

    // write using the requisite format
    const outputJson = JSON.stringify(config, undefined, 2);

    if (!this.output) {
      Deno.stdout.writeSync(
          new TextEncoder().encode(outputJson + "\n"),
      );
    } else {
      Deno.writeTextFileSync(this.output, outputJson + "\n");
    }
  }
}
