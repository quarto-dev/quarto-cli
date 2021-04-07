/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { basename } from "path/mod.ts";

import { Command } from "cliffy/command/mod.ts";

import { executionEngine, executionEngines } from "../../execute/engine.ts";

import { projectCreate } from "../../project/project-create.ts";
import { projectTypes } from "../../project/types/project-types.ts";
import { kOutputDir } from "../../project/project-context.ts";

const kProjectTypes = projectTypes();
const kExecutionEngines = executionEngines().reverse();

export const createProjectCommand = new Command()
  .name("create-project")
  .description("Create a project for rendering multiple documents")
  .arguments("[dir:string]")
  .option(
    "--title <title:string>",
    "Project title (defaults to directory name)",
  )
  .option(
    "--type <type:string>",
    `Project type (${kProjectTypes.join(", ")})`,
    {
      value: (value: string): string => {
        if (kProjectTypes.indexOf(value || "default") === -1) {
          throw new Error(
            `Project type must be one of ${
              kProjectTypes.join(", ")
            }, but got "${value}".`,
          );
        }
        return value;
      },
    },
  )
  .option(
    "--engine <engine:string>",
    `Use execution engine (${kExecutionEngines.join(", ")})`,
    {
      value: (value: string): string[] => {
        value = value || "none";
        const engine = executionEngine(value);
        if (!engine) {
          throw new Error(`Unknown --engine: ${value}`);
        }
        // check for kernel
        const match = value.match(/(\w+)(:(.+))?$/);
        if (match) {
          return [match[1], match[2]];
        } else {
          return [value];
        }
      },
    },
  )
  .option(
    "--output-dir <dir:string>",
    "Directory for project outputs",
  )
  .option(
    "--no-scaffold",
    "Don't create initial project file(s)",
  )
  .example(
    "Create a project in the current directory",
    "quarto create-project",
  )
  .example(
    "Create a project in the 'myproject' directory",
    "quarto create-project myproject",
  )
  .example(
    "Create a website project",
    "quarto create-project --type website",
  )
  .example(
    "Create a book project",
    "quarto create-project --type book",
  )
  .example(
    "Create a website project with jupyter",
    "quarto create-project --type website --engine jupyter",
  )
  .example(
    "Create a website project with jupyter + kernel",
    "quarto create-project --type website --engine jupyter:python3",
  )
  .example(
    "Create a book project with knitr",
    "quarto create-project --type book --engine knitr",
  )
  // deno-lint-ignore no-explicit-any
  .action(async (options: any, dir?: string) => {
    dir = dir || Deno.cwd();
    const engine = options.engine || [];
    await projectCreate({
      dir,
      type: options.type,
      title: options.title || basename(dir),
      scaffold: !!options.scaffold,
      engine: engine[0] || "none",
      [kOutputDir]: options.outputDir,
      kernel: engine[1],
      quiet: options.quiet,
    });
  });
