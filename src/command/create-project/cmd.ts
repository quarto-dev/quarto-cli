/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Command } from "cliffy/command/mod.ts";

import { createProject, kOutputDir } from "./create-project.ts";

export const createProjectCommand = new Command()
  .name("create-project")
  .arguments("[dir:string]")
  .option(
    "-T, --type <type:string>",
    "Project type (default, website, or book)",
    {
      default: "default",
      value: (value: string): string => {
        if (["default", "website", "book"].indexOf(value) === -1) {
          throw new Error(
            `Project type must be one of "default, website or book", but got "${value}".`,
          );
        }
        return value;
      },
    },
  )
  .option(
    "--template [template:string]",
    "Project template (default, none, or url)",
  )
  .option(
    "--name [name:string]",
    "Project name (defaults to dir name)",
  )
  .option(
    "--output-dir [dir:string]",
    "Output directory (default varies with project type)",
  )
  .example(
    "Create a new project",
    "quarto create-project",
  )
  .example(
    "Create a new book project",
    "quarto create-project --type book",
  )
  // deno-lint-ignore no-explicit-any
  .action(async (options: any, dir?: string) => {
    const result = await createProject({
      dir: dir || Deno.cwd(),
      type: options.type,
      name: options.name,
      [kOutputDir]: options[kOutputDir],
    });

    if (!result.success) {
      // error diagnostics already written to stderr
      Deno.exit(result.code);
    }
  });
