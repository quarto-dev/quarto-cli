/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/mod.ts";
import { dirname, relative } from "path/mod.ts";

import * as ld from "../../core/lodash.ts";

import { Command } from "cliffy/command/mod.ts";

import { kCss, kResources } from "../../config/constants.ts";
import { Format } from "../../config/types.ts";

import { projectContext } from "../../project/project-context.ts";

import { fileExecutionEngine } from "../../execute/engine.ts";
import { renderFormats } from "../render/render-contexts.ts";
import {
  resolveFileResources,
  resourcesFromMetadata,
} from "../render/resources.ts";
import { cssFileResourceReferences } from "../../core/css.ts";
import { kLocalDevelopment, quartoConfig } from "../../core/quarto.ts";

import {
  initState,
  setInitializer,
} from "../../core/lib/yaml-validation/state.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../core/schema/utils.ts";

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
  .action(async (_options: any, path: string) => {
    // one-time initialization of yaml validation modules
    setInitializer(initYamlIntelligenceResourcesFromFilesystem);
    await initState();

    path = path || Deno.cwd();

    if (!existsSync(path)) {
      throw new Error(`${path} not found`);
    }

    // get quarto version
    let version = quartoConfig.version();
    if (version === kLocalDevelopment) {
      version = "99.9.9";
    }

    // get project context (if any)
    const context = await projectContext(path);

    // deno-lint-ignore no-explicit-any
    let config: any | undefined;
    const stat = Deno.statSync(path);
    if (stat.isDirectory) {
      if (context?.config) {
        config = {
          quarto: {
            version,
          },
          engines: context.engines,
          config: context.config,
          files: context.files,
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
            resources = ld.uniq(resources.concat(
              resourcesFromMetadata(format.metadata[kResources]),
            ));
            // include css specified in metadata
            if (format.pandoc[kCss]) {
              return ld.uniq(resources.concat(
                resourcesFromMetadata(format.pandoc[kCss]),
              ));
            } else {
              return resources;
            }
          },
          [],
        );

        const context = await projectContext(path);
        const fileDir = Deno.realPathSync(dirname(path));
        const resources = await resolveResources(
          context ? context.dir : fileDir,
          fileDir,
          partitioned.markdown,
          resourceConfig,
        );

        // data to write
        config = {
          quarto: {
            version,
          },
          engines: [engine.name],
          formats,
          resources,
        };

        // if there is a project then add it
        if (context) {
          config.project = relative(dirname(path), context.dir);
        }
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

async function resolveResources(
  rootDir: string,
  fileDir: string,
  markdown: string,
  globs: string[],
): Promise<string[]> {
  const resolved = await resolveFileResources(
    rootDir,
    fileDir,
    markdown,
    globs,
  );
  const resources = ld.difference(
    resolved.include,
    resolved.exclude,
  ) as string[];
  const allResources = resources.concat(cssFileResourceReferences(resources));
  return allResources.map((file) => relative(rootDir, file));
}
