/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Command } from "cliffy/command/mod.ts";

import { kOutputDir } from "../../config/project.ts";
import { projectCreate } from "../../project/project-create.ts";

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
    "--scaffold [format:string]",
    "Create initial project file(s) with specified format",
    {
      default: "markdown",
      value: (value: string): string[] => {
        if (
          value !== "markdown" && value !== "rmd" &&
          !value.startsWith("jupyter")
        ) {
          throw new Error("Unknown format for --scaffold");
        }
        if (value.startsWith("jupyter")) {
          const match = value.match(/jupyter(:(.+))?$/);
          if (!match) {
            throw new Error(
              "Invalid jupyter format specification for --scaffold",
            );
          } else {
            return ["jupyter", match[2] || "python3"];
          }
        } else {
          return [value];
        }
      },
    },
  )
  .option(
    "--no-scaffold",
    "Don't create initial project file(s)",
  )
  .option(
    "--name [name:string]",
    "Project name (defaults to directory name)",
  )
  .option(
    "--output-dir [dir:string]",
    "Output directory (default varies with project type)",
  )
  .option(
    "--quiet",
    "Suppress warning and other messages.",
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
    "Create a book project in the current directory",
    "quarto create-project --type book",
  )
  .example(
    "Create a book project with formats html, pdf, and epub",
    "quarto create-project --type book --formats html,pdf,epub",
  )
  // deno-lint-ignore no-explicit-any
  .action(async (options: any, dir?: string) => {
    await projectCreate({
      dir: dir || Deno.cwd(),
      type: options.type,
      engine: options.scaffold[0],
      kernel: options.scaffold[1],
      name: options.name,
      [kOutputDir]: options[kOutputDir],
      quiet: options.quiet,
    });
  });
