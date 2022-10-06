/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

// import { executionEngine, executionEngines } from "../../../execute/engine.ts";

import { projectCreate } from "../../../project/project-create.ts";
import {
  parseProjectType,
  projectType,
  projectTypeAliases,
  projectTypes,
} from "../../../project/types/project-types.ts";
import { kMarkdownEngine } from "../../../execute/types.ts";

import { ArtifactCreator, CreateOptions } from "../cmd.ts";
import { basename, join } from "path/mod.ts";

import { Input, Select } from "cliffy/prompt/mod.ts";

// ensures project types are registered
import "../../../project/types/register.ts";

const kProjectTypes = projectTypes();
const kProjectTypeAliases = projectTypeAliases();
const kProjectTypesAndAliases = [...kProjectTypes, ...kProjectTypeAliases];

// const kExecutionEngines = executionEngines().reverse();
const kEditorTypes = ["source", "visual"];

const kTemplate = "template";
const kType = "type";
const kTitle = "title";
const kScaffold = "scaffold";
const kSubdirectory = "subdirectory";

const kBlogTypeAlias = "blog";

const kDefaultDirectory = "project";

const kTypeProj = "project";

const kProjectCreateTypes = [...kProjectTypes, kBlogTypeAlias];

export const projectArtifactCreator: ArtifactCreator = {
  displayName: "Project",
  type: kTypeProj,
  resolveAlias,
  resolveOptions,
  finalizeOptions,
  nextPrompt,
  createArtifact,
};

function resolveAlias(alias: string) {
  if (kProjectCreateTypes.includes(alias)) {
    return {
      type: kTypeProj,
      options: {
        type: alias,
      },
    };
  } else {
    return undefined;
  }
}

function resolveOptions(args: string[]): Record<string, unknown> {
  // The first argument is the type (website, default, etc...)
  // The second argument is the directory
  const typeRaw = args.length > 0 ? args[0] : undefined;
  const directoryRaw = args.length > 1 ? args[1] : undefined;

  const options: Record<string, unknown> = {};
  if (typeRaw) {
    if (kProjectCreateTypes.includes(typeRaw)) {
      // This is a recognized type
      options[kType] = typeRaw;
    }
  }
  // Populate a directory, if provided
  if (directoryRaw) {
    options[kSubdirectory] = directoryRaw;
  }

  return options;
}

// We specially handle website and blog
// (website means a website with the default template,
// blog means a website with the blog template)
function resolveTemplate(type: string) {
  if (type === "website") {
    return {
      type,
      template: "default",
    };
  } else if (type === kBlogTypeAlias) {
    return {
      type: "website",
      template: "blog",
    };
  } else {
    return {
      type,
    };
  }
}

function finalizeOptions(createOptions: CreateOptions) {
  // Resolve the type and template
  const resolved = resolveTemplate(
    createOptions.commandOpts[kType] as string || "default",
  );
  const type = resolved.type;
  createOptions.commandOpts.type = type;
  if (resolved.template) {
    createOptions.commandOpts[kTemplate] = resolved.template;
  }

  // If there is no template specified, use the default project
  // template, if one is available
  if (createOptions.commandOpts[kTemplate] === undefined) {
    const projType = projectType(type);
    const defaultTemplate = projType.templates && projType.templates.length > 0
      ? projType.templates[0]
      : undefined;
    createOptions.commandOpts[kTemplate] = defaultTemplate;
  }

  // Always create the scaffold files
  createOptions.commandOpts[kScaffold] = createOptions.commandOpts[kScaffold] ||
    true;

  // Provide a directory and title
  createOptions.commandOpts[kSubdirectory] =
    createOptions.commandOpts[kSubdirectory] || kDefaultDirectory;
  createOptions.commandOpts[kTitle] = createOptions.commandOpts[kTitle] ||
    createOptions.commandOpts[kSubdirectory];

  return createOptions;
}

function nextPrompt(
  createOptions: CreateOptions,
) {
  // First ensure that there is a type
  if (!createOptions.commandOpts[kType]) {
    const typeOrder = ["default", "website", kBlogTypeAlias, "book"];

    const orderedTypes = kProjectCreateTypes.sort((t1, t2) => {
      if (t1 === t2) {
        return 0;
      } else if (typeOrder.indexOf(t1) === -1) {
        return 1;
      } else {
        return typeOrder.indexOf(t1) - typeOrder.indexOf(t2);
      }
    });

    return {
      name: kType,
      message: "Type",
      type: Select,
      options: orderedTypes.map((t) => {
        return {
          name: t,
          value: t,
        };
      }),
    };
  }

  // Collect a title
  if (!createOptions.commandOpts[kSubdirectory]) {
    return {
      name: kSubdirectory,
      message: "Directory",
      type: Input,
    };
  }
}

async function createArtifact(createOptions: CreateOptions) {
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
  const fullPath = subdirectory
    ? join(createOptions.dir, subdirectory)
    : createOptions.dir;

  await projectCreate({
    dir: fullPath,
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

  return fullPath;
}
