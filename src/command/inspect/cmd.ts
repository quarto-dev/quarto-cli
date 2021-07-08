/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/mod.ts";
import { dirname, relative } from "path/mod.ts";

import { ld } from "lodash/mod.ts";

import { Command } from "cliffy/command/mod.ts";

import { kResources } from "../../config/constants.ts";
import { Format } from "../../config/types.ts";

import { projectContext } from "../../project/project-context.ts";

import { fileExecutionEngine } from "../../execute/engine.ts";
import { renderFormats } from "../render/render.ts";
import {
  resolveFileResources,
  resourcesFromMetadata,
} from "../render/resources.ts";

export const inspectCommand = new Command()
  .name("inspect")
  .arguments("[path:string]")
  .description(
    "Inspect a Quarto project or input path. Inspecting a project returns its config and engines.\n" +
      "Inspecting an input path return its formats, engine, and dependent resources.\n\n" +
      "Emits results of inspection as JSON to stdout.",
  )
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
  .action(async (_options: any, path: string) => {
    path = path || Deno.cwd();

    if (!existsSync(path)) {
      throw new Error(`${path} not found`);
    }

    // deno-lint-ignore no-explicit-any
    let config: any | undefined;
    const stat = Deno.statSync(path);
    if (stat.isDirectory) {
      const context = await projectContext(path);
      if (context?.config) {
        config = {
          engines: context.engines,
          config: context.config,
        };
      } else {
        throw new Error(`${path} is not a quarto project.`);
      }
    } else {
      const engine = fileExecutionEngine(path);
      if (engine) {
        // partition markdown
        const partitioned = await engine.partitionedMarkdown(path);

        // get formats
        const formats = await renderFormats(path);

        // accumulate resources from formats then resolve them
        const resourceConfig: string[] = Object.values(formats).reduce(
          (resources: string[], format: Format) => {
            return ld.uniq(resources.concat(
              resourcesFromMetadata(format.metadata[kResources]),
            ));
          },
          [],
        );

        const context = await projectContext(path);
        const fileDir = Deno.realPathSync(dirname(path));
        const resources = resolveResources(
          context ? context.dir : fileDir,
          fileDir,
          partitioned.markdown,
          resourceConfig,
        );

        // data to write
        config = {
          engine: engine.name,
          formats,
          resources,
        };
      } else {
        throw new Error(`${path} is not a valid Quarto input document`);
      }
    }

    // write using the requisite format
    const output = JSON.stringify(config, undefined, 2);

    Deno.stdout.writeSync(
      new TextEncoder().encode(output + "\n"),
    );
  });

function resolveResources(
  rootDir: string,
  fileDir: string,
  markdown: string,
  resources: string[],
): string[] {
  const resolved = resolveFileResources(rootDir, fileDir, markdown, resources);
  return (ld.difference(resolved.include, resolved.exclude) as string[])
    .map((file) => relative(rootDir, file));
}
