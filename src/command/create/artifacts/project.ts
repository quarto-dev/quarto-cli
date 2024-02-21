/*
 * project.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import {
  ArtifactCreator,
  CreateContext,
  CreateDirective,
} from "../cmd-types.ts";

import { capitalizeTitle } from "../../../core/text.ts";
import { kMarkdownEngine } from "../../../execute/types.ts";
import { projectCreate } from "../../../project/project-create.ts";
import {
  parseProjectType,
  projectType,
  projectTypeAliases,
  projectTypes,
} from "../../../project/types/project-types.ts";

import { Input, Select } from "cliffy/prompt/mod.ts";
import { join } from "path/mod.ts";

// ensures project types are registered
import "../../../project/types/register.ts";
import { warning } from "log/mod.ts";

const kProjectTypes = projectTypes();
const kProjectTypeAliases = projectTypeAliases();
const kProjectTypesAndAliases = [
  ...kProjectTypes,
  ...kProjectTypeAliases,
];

const kType = "type";
const kSubdirectory = "subdirectory";

const kBlogTypeAlias = "blog";
const kConfluenceAlias = "confluence";

const kTypeProj = "project";

const kProjectCreateTypes = [
  ...kProjectTypes,
  kBlogTypeAlias,
  kConfluenceAlias,
];
const kProjectTypeOrder = [
  "default",
  "website",
  kBlogTypeAlias,
  "manuscript",
  "book",
  kConfluenceAlias,
];

export const projectArtifactCreator: ArtifactCreator = {
  displayName: "Project",
  type: kTypeProj,
  resolveOptions,
  finalizeOptions,
  nextPrompt,
  createArtifact,
};

function resolveOptions(args: string[]): Record<string, unknown> {
  // The first argument is the type (website, default, etc...)
  // The second argument is the directory
  const typeRaw = args.length > 0 ? args[0] : undefined;
  const directoryRaw = args.length > 1 ? args[1] : undefined;
  const titleRaw = args.length > 2 ? args[2] : undefined;

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

  if (titleRaw) {
    options.name = titleRaw;
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
  } else if (type === "confluence") {
    return {
      type: "default",
      template: kConfluenceAlias,
    };
  } else {
    return {
      type,
    };
  }
}

function finalizeOptions(createContext: CreateContext) {
  const typeStr = createContext.options[kType] as string || "default";
  // Resolve the type and template
  const resolved = resolveTemplate(typeStr);
  const subdirectory = createContext.options[kSubdirectory] as string;
  if (!subdirectory) {
    throw new Error(
      "A directory is required for project creation with \`quarto create project\`",
    );
  }
  const directory = join(
    createContext.cwd,
    createContext.options[kSubdirectory] as string,
  );
  let name = createContext.options.name;
  if (!name) {
    name = defaultName(createContext.options[kSubdirectory], typeStr);
    warning(
      `No 'title' for project provided in \`quarto create project\`. Using '${name}' as default.`,
    );
  }
  const template = resolved.template
    ? `${resolved.type}:${resolved.template}`
    : resolved.type;

  return {
    displayType: "project",
    name,
    directory,
    template,
  } as CreateDirective;
}

function nextPrompt(
  createOptions: CreateContext,
) {
  // First ensure that there is a type
  if (!createOptions.options[kType]) {
    const orderedTypes = kProjectCreateTypes.sort((t1, t2) => {
      if (t1 === t2) {
        return 0;
      } else if (kProjectTypeOrder.indexOf(t1) === -1) {
        return 1;
      } else {
        return kProjectTypeOrder.indexOf(t1) - kProjectTypeOrder.indexOf(t2);
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

  // Collect a name
  if (!createOptions.options[kSubdirectory]) {
    return {
      name: kSubdirectory,
      message: "Directory",
      type: Input,
    };
  }

  if (!createOptions.options.name) {
    return {
      name: "name",
      message: "Title",
      type: Input,
      default: defaultName(
        createOptions.options[kSubdirectory],
        createOptions.options[kType],
      ),
    };
  }
}

async function createArtifact(
  createDirective: CreateDirective,
  quiet?: boolean,
) {
  const dir = createDirective.directory;
  const projectTitle = capitalizeTitle(createDirective.name);
  const directiveType = createDirective.template;

  // Parse the project type and template
  const { type, template } = parseProjectType(directiveType);

  // Validate the type
  if (kProjectTypesAndAliases.indexOf(type) === -1) {
    throw new Error(
      `Project type must be one of ${
        kProjectTypes.join(", ")
      }, but got "${type}".`,
    );
  }

  // Validate the template
  const projType = projectType(type);
  if (template && !projType.templates?.includes(template)) {
    if (projType.templates) {
      throw new Error(
        `Project template must be one of ${
          projType.templates.join(", ")
        }, but got "${template}".`,
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
    title: projectTitle,
    scaffold: true,
    engine: kMarkdownEngine,
    template: template,
    quiet,
  });

  return {
    path: dir,
    openfiles: type !== "default"
      ? ["index.qmd", "_quarto.yml"]
      : ["_quarto.yml"],
  };
}

// choose a default name if none provided in the createContext
function defaultName(subdirectory, type) {
  return subdirectory !== "." ? subdirectory : type;
}
