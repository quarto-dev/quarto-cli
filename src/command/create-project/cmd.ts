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
    "--formats [formats:string]",
    "Comma separated list of formats to use in the project",
    {
      value: (value: string): string[] => {
        return value.split(/,/);
      },
    },
  )
  .option(
    "--name [name:string]",
    "Project name (defaults to directory name)",
  )
  .option(
    "--output-dir [dir:string]",
    "Output directory (default varies with project type)",
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
    "Create a website project with '_public' as the output dir",
    "quarto create-project --type website --output-dir _public",
  )
  .example(
    "Create a book project in the current directory",
    "quarto create-project --type book",
  )
  .example(
    "Create a book project with formats html, pdf, and epub",
    "quarto create-project --type book --formats html,pdf,epub",
  )
  // deno-lint-ignore no-explicit-any
  .action(async (options: any, dir?: string) => {
    const result = await createProject({
      dir: dir || Deno.cwd(),
      type: options.type,
      name: options.name,
      [kOutputDir]: options[kOutputDir],
      formats: options.formats,
    });

    if (!result.success) {
      // error diagnostics already written to stderr
      Deno.exit(result.code);
    }
  });
