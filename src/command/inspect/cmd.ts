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

import { readYamlFromMarkdown } from "../../core/yaml.ts";
import { resolvePathGlobs } from "../../core/path.ts";

import { kResources } from "../../config/constants.ts";

import { kQuartoIgnore } from "../../project/project-gitignore.ts";
import { projectContext } from "../../project/project-context.ts";

import {
  engineIgnoreGlobs,
  fileExecutionEngine,
} from "../../execute/engine.ts";
import { renderFormats } from "../render/render.ts";

export const inspectCommand = new Command()
  .name("inspect")
  .arguments("[path:string]")
  .description(
    "Inspect a Quarto project or input path. Inspecting a project returns its config and " +
      "engines; inspecting an input path return its formats, engine, and dependent resources.\n\n" +
      "Emits results of inspection as JSON to stdout",
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
        const formats = await renderFormats(path);

        // partition markdown
        const partitioned = await engine.partitionedMarkdown(path);

        // compute resources
        const resources: string[] = [];
        if (partitioned.yaml) {
          const frontMatter = readYamlFromMarkdown(partitioned.yaml);
          if (frontMatter[kResources]) {
            resources.push(
              ...resolveResources(
                Deno.realPathSync(dirname(path)),
                frontMatter[kResources],
              ),
            );
          }
        }

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

function resolveResources(rootDir: string, entries: unknown): string[] {
  const globs: string[] = [];
  if (Array.isArray(entries)) {
    for (const file of entries) {
      globs.push(String(file));
    }
  } else {
    globs.push(String(entries));
  }
  const ignore = engineIgnoreGlobs()
    .concat(kQuartoIgnore)
    .concat(["**/.*", "**/.*/**"]); // hidden (dot prefix))
  const resolved = resolvePathGlobs(rootDir, globs, ignore);

  return (ld.difference(resolved.include, resolved.exclude) as string[])
    .map((file) => relative(rootDir, file));
}
