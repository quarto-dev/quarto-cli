/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Command } from "cliffy/command/mod.ts";

import { createProject } from "./create-project.ts";

export const createProjectCommand = new Command()
  .name("create-project")
  .arguments("[dir:string]")
  .option(
    "-T, --type <type:string>",
    "Project type (collection, website, or book)",
    {
      default: "collection",
      value: (value: string): string => {
        if (["collection", "website", "book"].indexOf(value) === -1) {
          throw new Error(
            `Project type must be one of "collection, wbsite or book", but got "${value}".`,
          );
        }
        return value;
      },
    },
  )
  .option(
    "--name [name:string]",
    "Project name (defaults to dir name)",
  )
  .option(
    "--output-dir [dir:string]",
    "Output directory",
  )
  .example(
    "Create a new project",
    "quarto create-project",
  )
  .example(
    "Create a new bookproject",
    "quarto create-project --type book",
  )
  // deno-lint-ignore no-explicit-any
  .action(async (options: any, dir?: string) => {
    const result = await createProject({
      dir: dir || Deno.cwd(),
      type: options.type,
      name: options.name,
      outputDir: options["output-dir"],
    });

    if (!result.success) {
      // error diagnostics already written to stderr
      Deno.exit(result.code);
    }
  });
