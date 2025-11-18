/*
 * extension.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import {
  ArtifactCreator,
  CreateContext,
  CreateDirective,
} from "../cmd-types.ts";

import { ejsData, renderAndCopyArtifacts } from "./artifact-shared.ts";

import { resourcePath } from "../../../core/resources.ts";

import { Input, Select } from "cliffy/prompt/mod.ts";
import { dirname, join } from "../../../deno_ral/path.ts";
import { copySync, ensureDirSync, existsSync } from "../../../deno_ral/fs.ts";

const kType = "type";
const kSubType = "subtype";
const kName = "name";
const kCellLanguage = "cellLanguage";

const kTypeExtension = "extension";

interface ExtensionType {
  name: string;
  value: string;
  openfiles: string[];
}

const kExtensionTypes: Array<string | ExtensionType> = [
  { name: "shortcode", value: "shortcode", openfiles: ["example.qmd"] },
  { name: "filter", value: "filter", openfiles: ["example.qmd"] },
  {
    name: "revealjs plugin",
    value: "revealjs-plugin",
    openfiles: ["example.qmd"],
  },
  { name: "journal format", value: "journal", openfiles: ["template.qmd"] },
  { name: "custom format", value: "format", openfiles: ["template.qmd"] },
  { name: "metadata", value: "metadata", openfiles: [] },
  { name: "brand", value: "brand", openfiles: [] },
  { name: "engine", value: "engine", openfiles: ["example.qmd"] },
];

const kExtensionSubtypes: Record<string, string[]> = {
  "format": ["html", "pdf", "docx", "revealjs", "typst"],
};

const kExtensionValues = kExtensionTypes.filter((t) => typeof t === "object")
  .map((t) => (t as { name: string; value: string }).value);

export const extensionArtifactCreator: ArtifactCreator = {
  displayName: "Extension",
  type: kTypeExtension,
  resolveOptions,
  finalizeOptions,
  nextPrompt,
  createArtifact,
};

function resolveOptions(args: string[]): Record<string, unknown> {
  // The first argument is the extension type
  // The second argument is the name
  // The third argument is the cell language (for engine extensions)
  const typeRaw = args.length > 0 ? args[0] : undefined;
  const nameRaw = args.length > 1 ? args[1] : undefined;
  const cellLanguageRaw = args.length > 2 ? args[2] : undefined;

  const options: Record<string, unknown> = {};

  // Populate the type data
  if (typeRaw) {
    const [type, template] = typeRaw.split(":");
    options[kType] = type;
    options[kSubType] = template;
  }

  // Populate a directory, if provided
  if (nameRaw) {
    options[kName] = nameRaw;
  }

  // For engine type, populate the cell language if provided
  if (cellLanguageRaw && options[kType] === "engine") {
    options[kCellLanguage] = cellLanguageRaw;
  }

  return options;
}

function finalizeOptions(createOptions: CreateContext) {
  // There should be a name
  if (!createOptions.options.name) {
    throw new Error("Required property 'name' is missing.");
  }

  // Is the type valid
  const type = createOptions.options[kType] as string;
  if (!kExtensionValues.includes(type)) {
    throw new Error(
      `The type ${type} isn't valid. Expected one of ${
        kExtensionValues.join(", ")
      }`,
    );
  }

  // Is the subtype valid
  const subType = createOptions.options[kSubType] as string;
  const subTypes = kExtensionSubtypes[type];
  if (subTypes && !subTypes.includes(subType)) {
    throw new Error(
      `The sub type ${subType} isn't valid. Expected one of ${
        subTypes.join(", ")
      }`,
    );
  }

  // Form a template
  const template = createOptions.options[kSubType]
    ? `${createOptions.options[kType]}:${createOptions.options[kSubType]}`
    : createOptions.options[kType];

  // Provide a directory and title
  return {
    displayType: "extension",
    name: createOptions.options[kName],
    directory: join(
      createOptions.cwd,
      createOptions.options[kName] as string,
    ),
    template,
    options: createOptions.options,
  } as CreateDirective;
}

function nextPrompt(
  createOptions: CreateContext,
) {
  // First ensure that there is a type
  if (!createOptions.options[kType]) {
    return {
      name: kType,
      message: "Type",
      type: Select,
      options: kExtensionTypes.map((t) => {
        if (t === "---") {
          return Select.separator("--------");
        } else {
          return t;
        }
      }),
    };
  }

  const subTypes = kExtensionSubtypes[createOptions.options[kType] as string];
  if (
    !createOptions.options[kSubType] &&
    subTypes && subTypes.length > 0
  ) {
    return {
      name: kSubType,
      message: "Base Format",
      type: Select,
      options: subTypes.map((t) => {
        return {
          name: t,
          value: t,
        };
      }),
    };
  }

  // Collect a title
  if (!createOptions.options[kName]) {
    return {
      name: kName,
      message: "Extension Name",
      type: Input,
    };
  }

  // Collect cell language for engine extensions
  if (
    createOptions.options[kType] === "engine" &&
    !createOptions.options[kCellLanguage]
  ) {
    return {
      name: kCellLanguage,
      message: "Default cell language name",
      type: Input,
      default: createOptions.options[kName] as string,
    };
  }
}

function typeFromTemplate(template: string) {
  return template.split(":")[0];
}

async function createArtifact(
  createDirective: CreateDirective,
  quiet?: boolean,
) {
  // Find the type using the template
  const createType = typeFromTemplate(createDirective.template);
  const extType = kExtensionTypes.find((type) => {
    if (typeof type === "object") {
      return type.value === createType;
    } else {
      return false;
    }
  });
  if (!extType) {
    throw new Error(`Unrecognized extension type ${createType}`);
  }
  const openfiles = extType ? (extType as ExtensionType).openfiles : [];

  // Create the extension
  await createExtension(createDirective, quiet);
  return {
    path: createDirective.directory,
    openfiles,
  };
}

async function createExtension(
  createDirective: CreateDirective,
  quiet?: boolean,
) {
  // The folder for this extension
  const artifact = templateFolder(createDirective);

  // The target directory
  const target = createDirective.directory;

  if (existsSync(target)) {
    // The target directory already exists
    throw new Error(
      `The directory ${target} already exists. Quarto extensions must have unique names - please modify the existing extension or use a unique name.`,
    );
  }

  // Data for this extension
  const data = await ejsData(createDirective);

  // Render or copy the artifact
  const filesCreated = renderAndCopyArtifacts(
    target,
    artifact,
    createDirective,
    data,
    quiet,
  );

  // For engine extensions, copy the current quarto-types
  const createType = typeFromTemplate(createDirective.template);
  if (createType === "engine") {
    // Try to find types in the distribution (production)
    let typesSource = resourcePath("quarto-types.d.ts");

    if (!existsSync(typesSource)) {
      // Development build - get from source tree
      const quartoRoot = Deno.env.get("QUARTO_ROOT");
      if (!quartoRoot) {
        throw new Error(
          "Cannot find quarto-types.d.ts. QUARTO_ROOT environment variable not set.",
        );
      }
      typesSource = join(quartoRoot, "packages/quarto-types/dist/index.d.ts");
    }

    const typesTarget = join(
      target,
      "_extensions",
      createDirective.name,
      "types",
      "quarto-types.d.ts",
    );
    ensureDirSync(dirname(typesTarget));
    copySync(typesSource, typesTarget);
  }

  return filesCreated[0];
}

function templateFolder(createDirective: CreateDirective) {
  const basePath = resourcePath(join("create", "extensions"));
  const artifactFolderName = createDirective.template.replace(":", "-");
  return join(basePath, artifactFolderName);
}
