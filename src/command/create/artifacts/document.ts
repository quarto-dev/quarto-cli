/*
* document.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { ArtifactCreator, CreateContext } from "../cmd.ts";
import {
  CreateDirective,
  ejsData,
  renderAndCopyArtifacts,
} from "./artifact-shared.ts";

import { Input } from "cliffy/prompt/mod.ts";
import { join } from "../../../deno_ral/path.ts";

import { safeExistsSync } from "../../../core/path.ts";
import { resourcePath } from "../../../core/resources.ts";

const kFormat = "format";
const kTitle = "title";

const kTypeDocument = "document";

export const documentArtifactCreator: ArtifactCreator = {
  displayName: "Document",
  type: kTypeDocument,
  resolveOptions,
  finalizeOptions,
  nextPrompt,
  createArtifact,
};

function resolveOptions(args: string[]): Record<string, unknown> {
  // The first argument is the extension type
  // The second argument is the name
  const formatRaw = args.length > 0 ? args[0] : undefined;
  const titleRaw = args.length > 1 ? args[1] : undefined;

  const options: Record<string, unknown> = {};

  // Populate the type data
  if (formatRaw) {
    options[kFormat] = formatRaw;
  }

  // Populate a directory, if provided
  if (titleRaw) {
    options[kTitle] = titleRaw;
  }

  return options;
}

function finalizeOptions(createOptions: CreateContext) {
  // There should be a name
  if (!createOptions.options.title) {
    throw new Error("Required property 'title' is missing.");
  }

  // Form a template
  const template = createOptions.options[kFormat];

  // Provide a directory and title
  return {
    displayType: "document",
    name: createOptions.options[kTitle],
    directory: createOptions.cwd,
    template,
    options: createOptions.options,
  } as CreateDirective;
}

function nextPrompt(
  createOptions: CreateContext,
) {
  // First ensure that there is a type
  if (!createOptions.options[kFormat]) {
    return {
      name: kFormat,
      message: "Format",
      type: Input,
    };
  }

  // Collect a title
  if (!createOptions.options[kTitle]) {
    return {
      name: kTitle,
      message: "Document Title",
      type: Input,
    };
  }
}

async function createArtifact(
  createDirective: CreateDirective,
  quiet?: boolean,
) {
  const fileName = await createDocument(createDirective, quiet);

  return {
    path: fileName,
    openfiles: [fileName],
  };
}

async function createDocument(
  createDirective: CreateDirective,
  quiet?: boolean,
) {
  // The folder for this extension
  const artifact = templateFolder(createDirective);

  // The target directory
  const target = createDirective.directory;

  // Data for this extension
  const data = await ejsData(createDirective);
  if (createDirective.options[kFormat]) {
    data[kFormat] = createDirective.options[kFormat] as string;
  }

  // Render or copy the artifact
  const filesCreated = renderAndCopyArtifacts(
    target,
    artifact,
    createDirective,
    data,
    quiet,
  );

  return filesCreated[0];
}

function templateFolder(createDirective: CreateDirective) {
  const basePath = resourcePath(join("create", "documents"));
  const formatSpecificPath = join(basePath, createDirective.template);
  if (safeExistsSync(formatSpecificPath)) {
    return formatSpecificPath;
  } else {
    return join(basePath, "default");
  }
}
