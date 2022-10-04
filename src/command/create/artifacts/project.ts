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
import { basename } from "path/mod.ts";

import { Confirm, ConfirmOptions, Select } from "cliffy/prompt/mod.ts";

// ensures project types are registered
import "../../../project/types/register.ts";

const kProjectTypes = projectTypes();
const kProjectTypeAliases = projectTypeAliases();
const kProjectTypesAndAliases = [...kProjectTypes, ...kProjectTypeAliases];

const kExecutionEngines = executionEngines().reverse();
const kEditorTypes = ["source", "visual"];

// list of options to gather

// the create command with options

//shared options
// -directory

export function prompts(createOptions: CreateOptions): Array<ConfirmOptions> {
  const prompts = [];
  if (!createOptions.commandOpts["type"]) {
    prompts.push({
      name: "type",
      message: "Select the type of project you'd like to create",
      type: Select,
      options: kProjectTypes.map((t) => {
        return {
          name: t,
          value: t,
        };
      }),
    });
  }
  return prompts;
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

  await projectCreate({
    dir: createOptions.dir,
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
