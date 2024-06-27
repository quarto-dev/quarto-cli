/*
 * cmd.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { basename } from "../../deno_ral/path.ts";

import { Command } from "cliffy/command/mod.ts";

import { executionEngine, executionEngines } from "../../execute/engine.ts";

import { projectCreate } from "../../project/project-create.ts";
import {
  parseProjectType,
  projectType,
  projectTypeAliases,
  projectTypes,
} from "../../project/types/project-types.ts";
import { kMarkdownEngine } from "../../execute/types.ts";

// ensures project types are registered
import "../../project/types/register.ts";

const kProjectTypes = projectTypes();
const kProjectTypeAliases = projectTypeAliases();
const kProjectTypesAndAliases = [...kProjectTypes, ...kProjectTypeAliases];

const kExecutionEngines = executionEngines().reverse();
const kEditorTypes = ["source", "visual"];

export const createProjectCommand = new Command()
  .name("create-project")
  .description("Create a project for rendering multiple documents")
  .arguments("[dir:string]")
  .hidden()
  .option(
    "--title <title:string>",
    "Project title",
  )
  .option(
    "--type <type:string>",
    `Project type (${kProjectTypes.join(", ")})`,
  )
  .option(
    "--template <type:string>",
    `Use a specific project template`,
  )
  .option(
    "--engine <engine:string>",
    `Use execution engine (${kExecutionEngines.join(", ")})`,
    {
      value: (value: string): string[] => {
        value = value || kMarkdownEngine;
        const engine = executionEngine(value.split(":")[0]);
        if (!engine) {
          throw new Error(`Unknown --engine: ${value}`);
        }
        // check for kernel
        const match = value.match(/(\w+)(:(.+))?$/);
        if (match) {
          return [match[1], match[3]];
        } else {
          return [value];
        }
      },
    },
  )
  .option(
    "--editor <editor:string>",
    "Default editor for project ('source' or 'visual')",
  )
  .option(
    "--with-venv [packages:string]",
    "Create a virtualenv for this project",
  )
  .option(
    "--with-condaenv [packages:string]",
    "Create a condaenv for this project",
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
    "quarto create-project mysite --type website",
  )
  .example(
    "Create a blog project",
    "quarto create-project mysite --type website --template blog",
  )
  .example(
    "Create a book project",
    "quarto create-project mybook --type book",
  )
  .example(
    "Create a website project with jupyter",
    "quarto create-project mysite --type website --engine jupyter",
  )
  .example(
    "Create a website project with jupyter + kernel",
    "quarto create-project mysite --type website --engine jupyter:python3",
  )
  .example(
    "Create a book project with knitr",
    "quarto create-project mybook --type book --engine knitr",
  )
  .example(
    "Create jupyter project with virtualenv",
    "quarto create-project myproject --engine jupyter --with-venv",
  )
  .example(
    "Create jupyter project with virtualenv + packages",
    "quarto create-project myproject --engine jupyter --with-venv pandas,matplotlib",
  )
  .example(
    "Create jupyter project with condaenv ",
    "quarto create-project myproject --engine jupyter --with-condaenv",
  )
  .example(
    "Create jupyter project with condaenv + packages",
    "quarto create-project myproject --engine jupyter --with-condaenv pandas,matplotlib",
  )
  // deno-lint-ignore no-explicit-any
  .action(async (options: any, dir?: string) => {
    if (dir === undefined || dir === ".") {
      dir = Deno.cwd();
    }

    const engine = options.engine || [];

    const envPackages = typeof (options.withVenv) === "string"
      ? options.withVenv.split(",").map((pkg: string) => pkg.trim())
      : typeof (options.withCondaenv) === "string"
      ? options.withCondaenv.split(",").map((pkg: string) => pkg.trim())
      : undefined;

    // Parse the project type and template
    const { type, template } = parseProjectType(options.type);
    const projectTemplate = options.template || template;

    // Validate the type
    if (kProjectTypesAndAliases.indexOf(type) === -1) {
      throw new Error(
        `Project type must be one of ${
          kProjectTypes.join(", ")
        }, but got "${type}".`,
      );
    }

    // Validate the editor
    const editorType = options.editor;
    if (editorType && !kEditorTypes.includes(editorType)) {
      throw new Error(
        `Editor type must be one of ${
          kEditorTypes.join(", ")
        }, but got "${editorType}".`,
      );
    }

    // Validate the template
    const projType = projectType(type);
    if (projectTemplate && !projType.templates?.includes(projectTemplate)) {
      if (projType.templates) {
        throw new Error(
          `Project template must be one of ${
            projType.templates.join(", ")
          }, but got "${projectTemplate}".`,
        );
      } else {
        throw new Error(
          `The project type ${type} does not support any templates.`,
        );
      }
    }

    await projectCreate({
      dir,
      type: type,
      title: options.title || basename(dir),
      scaffold: !!options.scaffold,
      engine: engine[0] || kMarkdownEngine,
      kernel: engine[1],
      editor: editorType,
      venv: !!options.withVenv,
      condaenv: !!options.withCondaenv,
      envPackages,
      template: projectTemplate,
    });
  });
