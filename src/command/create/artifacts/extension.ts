/*
* extension.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

// import { executionEngine, executionEngines } from "../../../execute/engine.ts";

import { ArtifactCreator, CreateOptions } from "../cmd.ts";
import { join } from "path/mod.ts";

import { Input, Select } from "cliffy/prompt/mod.ts";

const kType = "type";
const kTitle = "title";
const kScaffold = "scaffold";
const kSubdirectory = "subdirectory";

const kDefaultDirectory = "extension";

const kTypeExtension = "extension";

const kExtensionTypes = ["filter", "format", "shortcode"];

export const extensionArtifactCreator: ArtifactCreator = {
  displayName: "Extension",
  type: kTypeExtension,
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

  const options: Record<string, unknown> = {};
  if (typeRaw) {
    if (kExtensionTypes.includes(typeRaw)) {
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

function finalizeOptions(createOptions: CreateOptions) {
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
    return {
      name: kType,
      message: "Type",
      type: Select,
      options: kExtensionTypes.map((t) => {
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

function createArtifact(createOptions: CreateOptions) {
  const options = createOptions.commandOpts;

  // Validate the type
  const type = options.type as string | undefined;
  if (type === undefined) {
    throw new Error(
      `You must provide an extension type.`,
    );
  } else if (kExtensionTypes.indexOf(type) === -1) {
    throw new Error(
      `Extension type must be one of ${
        kExtensionTypes.join(", ")
      }, but got "${type}".`,
    );
  }

  const subdirectory = createOptions.commandOpts["subdirectory"] as string;
  const fullPath = subdirectory
    ? join(createOptions.dir, subdirectory)
    : createOptions.dir;

  console.log(createOptions);

  return Promise.resolve(fullPath);
}
