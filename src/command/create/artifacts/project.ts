/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { executionEngine, executionEngines } from "../../../execute/engine.ts";

import { projectCreate } from "../../../project/project-create.ts";
import {
  parseProjectType,
  projectType,
  projectTypeAliases,
  projectTypes,
} from "../../../project/types/project-types.ts";
import { kMarkdownEngine } from "../../../execute/types.ts";

import { CreateOptions } from "../cmd.ts";
import { basename, join } from "path/mod.ts";

import { Confirm, Input, Select } from "cliffy/prompt/mod.ts";

// ensures project types are registered
import "../../../project/types/register.ts";

const kProjectTypes = projectTypes();
const kProjectTypeAliases = projectTypeAliases();
const kProjectTypesAndAliases = [...kProjectTypes, ...kProjectTypeAliases];

const kExecutionEngines = executionEngines().reverse();
const kEditorTypes = ["source", "visual"];

const kTemplate = "template";
const kType = "type";
const kTitle = "title";
const kScaffold = "scaffold";
const kSubdirectory = "subdirectory";

export function parseArgs(args: string[]): Record<string, unknown> {
  if (args.length > 0) {
    const type = args[0];
    if (type) {
      if (kProjectTypes.includes(type)) {
        return {
          type,
        };
      } else {
        return {};
      }
    } else {
      return {};
    }
  } else {
    return {};
  }
}

export function nextPrompt(
  createOptions: CreateOptions,
): any | undefined {
  // First ensure that there is a type
  if (!createOptions.commandOpts[kType]) {
    return {
      name: kType,
      message: "Project type",
      type: Select,
      options: kProjectTypes.map((t) => {
        return {
          name: t,
          value: t,
        };
      }),
    };
  }

  // Next, if this type supports various templates, ask about those
  const template = createOptions.commandOpts[kTemplate];
  const type = createOptions.commandOpts[kType] as string;
  const projType = projectType(type);
  if (
    template === undefined && projType.templates &&
    projType.templates.length > 0
  ) {
    return {
      name: kTemplate,
      message: `Select the type of ${type}`,
      type: Select,
      options: projType.templates.map((template) => {
        return {
          name: template,
          value: template,
        };
      }),
    };
  }

  // Collect whether to populate a scaffold
  if (!createOptions.commandOpts[kScaffold]) {
    return {
      name: kScaffold,
      message: "Create initial project file(s)",
      type: Confirm,
    };
  }

  // Collect a title
  if (!createOptions.commandOpts[kTitle]) {
    return {
      name: kTitle,
      message: "Project title",
      type: Input,
    };
  }

  if (!createOptions.commandOpts["subdirectory"]) {
    return {
      name: kSubdirectory,
      message: "Name of project directory",
      type: Input,
    };
  }
}

export async function create(createOptions: CreateOptions) {
  const options = createOptions.commandOpts;

  const engine = (options.engine || []) as string[];
  const createType = options.type as string;
  const createTemplate = options.template as string;
  const createTitle = options.title as string;

  const envPackages = typeof (options.withVenv) === "string"
    ? options.withVenv.split(",").map((pkg: string) => pkg.trim())
    : typeof (options.withCondaenv) === "string"
    ? options.withCondaenv.split(",").map((pkg: string) => pkg.trim())
    : undefined;

  // Parse the project type and template
  const { type, template } = parseProjectType(createType);
  const projectTemplate = createTemplate || template;

  // Validate the type
  if (kProjectTypesAndAliases.indexOf(type) === -1) {
    throw new Error(
      `Project type must be one of ${
        kProjectTypes.join(", ")
      }, but got "${type}".`,
    );
  }

  // Validate the editor
  const editorType = options.editor as string;
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

  const subdirectory = createOptions.commandOpts["subdirectory"] as string;

  await projectCreate({
    dir: subdirectory
      ? join(createOptions.dir, subdirectory)
      : createOptions.dir,
    type: type,
    title: createTitle || basename(createOptions.dir),
    scaffold: !!options.scaffold,
    engine: engine[0] || kMarkdownEngine,
    kernel: engine[1],
    editor: editorType,
    venv: !!options.withVenv,
    condaenv: !!options.withCondaenv,
    envPackages,
    template: projectTemplate,
  });
}
