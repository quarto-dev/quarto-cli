/*
 * cmd.ts
 *
 * Copyright (C) 2020-2024 Posit Software, PBC
 */

import { basename } from "../../deno_ral/path.ts";

import { Command, Option } from "npm:clipanion";

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

// TODO: can this be part of the option definition?
const parseEngine = (value: string): string[] => {
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
};

export class CreateProjectCommand extends Command {
  static name = 'create-project';
  static paths = [[CreateProjectCommand.name]];

  static usage = Command.Usage({
    category: 'internal',
    description: 'Create a project for rendering multiple documents',
    examples: [
      [
        "Create a project in the current directory",
        `$0 ${CreateProjectCommand.name}`,
      ], [
        "Create a project in the 'myproject' directory",
        `$0 ${CreateProjectCommand.name} myproject`,
      ], [
        "Create a website project",
        `$0 ${CreateProjectCommand.name} mysite --type website`,
      ], [
        "Create a blog project",
        `$0 ${CreateProjectCommand.name} mysite --type website --template blog`,
      ], [
        "Create a book project",
        `$0 ${CreateProjectCommand.name} mybook --type book`,
      ], [
        "Create a website project with jupyter",
        `$0 ${CreateProjectCommand.name} mysite --type website --engine jupyter`,
      ], [
        "Create a website project with jupyter + kernel",
        `$0 ${CreateProjectCommand.name} mysite --type website --engine jupyter:python3`,
      ], [
        "Create a book project with knitr",
        `$0 ${CreateProjectCommand.name} mybook --type book --engine knitr`,
      ], [
        "Create jupyter project with virtualenv",
        `$0 ${CreateProjectCommand.name} myproject --engine jupyter --with-venv`,
      ], [
        "Create jupyter project with virtualenv + packages",
        `$0 ${CreateProjectCommand.name} myproject --engine jupyter --with-venv pandas,matplotlib`,
      ], [
        "Create jupyter project with condaenv",
        `$0 ${CreateProjectCommand.name} myproject --engine jupyter --with-condaenv`,
      ], [
        "Create jupyter project with condaenv + packages",
        `$0 ${CreateProjectCommand.name} myproject --engine jupyter --with-condaenv pandas,matplotlib`,
      ]
    ],
  });

  dir = Option.String({ required: false });

  editor = Option.String('--editor', { description: "Default editor for project ('source' or 'visual')" });
  engine = Option.String('--engine', { description: `Use execution engine (${kExecutionEngines.join(", ")})` });
  noScaffold = Option.Boolean('--no-scaffold', { description: "Don't create initial project file(s)" });
  template = Option.String('--template', { description: "Use a specific project template" });
  title = Option.String('--title', { description: "Project title" });
  type = Option.String('--type', { description: `Project type (${kProjectTypes.join(", ")})` });
  withCondaenv = Option.String('--with-condaenv', { description: "Create a condaenv for this project", tolerateBoolean: true });
  withVenv = Option.String('--with-venv', { description: "Create a virtualenv for this project", tolerateBoolean: true });

  async execute() {
    const dir = (this.dir === undefined || this.dir === ".") ? Deno.cwd() : this.dir;
    const engine = this.engine ? parseEngine(this.engine) : [];

    const envPackages = typeof (this.withVenv) === "string"
      ? this.withVenv.split(",").map((pkg: string) => pkg.trim())
      : typeof (this.withCondaenv) === "string"
      ? this.withCondaenv.split(",").map((pkg: string) => pkg.trim())
      : undefined;

    // Parse the project type and template
    const { type, template } = parseProjectType(this.type);
    const projectTemplate = this.template || template;

    // Validate the type
    if (kProjectTypesAndAliases.indexOf(type) === -1) {
      throw new Error(
        `Project type must be one of ${
          kProjectTypes.join(", ")
        }, but got "${type}".`,
      );
    }

    // Validate the editor
    const editorType = this.editor;
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
      type,
      title: this.title || basename(dir),
      scaffold: !this.noScaffold,
      engine: engine[0] || kMarkdownEngine,
      kernel: engine[1],
      editor: editorType,
      venv: !!this.withVenv,
      condaenv: !!this.withCondaenv,
      envPackages,
      template: projectTemplate,
    });
  }
}
