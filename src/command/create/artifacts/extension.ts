/*
* extension.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ArtifactCreator, CreateContext, CreateDirective } from "../cmd.ts";

import { Input, Select } from "cliffy/prompt/mod.ts";
import { resourcePath } from "../../../core/resources.ts";
import { copyMinimal } from "../../../core/copy.ts";
import {
  basename,
  dirname,
  extname,
} from "../../../vendor/deno.land/std@0.153.0/path/win32.ts";
import { capitalizeTitle } from "../../../core/text.ts";
import { quartoConfig } from "../../../core/quarto.ts";
import { renderEjs } from "../../../core/ejs.ts";

import { ensureDirSync, walkSync } from "fs/mod.ts";
import { coerce } from "semver/mod.ts";
import { join, relative } from "path/mod.ts";
import { execProcess } from "../../../core/process.ts";

const kType = "type";
const kSubType = "subtype";
const kName = "name";

const kTypeExtension = "extension";

const kExtensionTypes = [
  { name: "filter", value: "filter" },
  { name: "shortcode", value: "shortcode" },
  { name: "revealjs plugin", value: "revealjs-plugin" },
  "---",
  { name: "journal format", value: "journal" },
  { name: "custom format", value: "format" },
];

const kExtensionSubtypes: Record<string, string[]> = {
  "format": ["html", "pdf", "docx", "revealjs"],
};

const kExtensionValues = kExtensionTypes.filter((t) => typeof (t) === "object")
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
  const typeRaw = args.length > 0 ? args[0] : undefined;
  const nameRaw = args.length > 1 ? args[1] : undefined;

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
    name: createOptions.options[kName],
    directory: join(
      createOptions.cwd,
      createOptions.options[kName] as string,
    ),
    template,
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
}

async function createArtifact(createDirective: CreateDirective) {
  await createExtension(createDirective);
  return createDirective.directory;
}

async function createExtension(createDirective: CreateDirective) {
  // The folder for this extension
  const artifact = templateFolder(createDirective);

  // The target directory
  const target = createDirective.directory;

  // Data for this extension
  const data = await ejsData(createDirective);

  // Ensure that the target directory exists and
  // copy the files
  ensureDirSync(target);
  copyMinimal(
    artifact,
    createDirective.directory,
    undefined,
    (src: string) => {
      const srcFileName = basename(src);
      if (srcFileName.includes(".ejs.")) {
        // Render the EJS file rather than copying this file
        renderFile(artifact, src, target, data);
        return false;
      } else {
        // Copy this file
        return true;
      }
    },
  );

  // extension-filesafeName
  const renamed = (name: string, data: CreateDirectiveData) => {
    if (name.startsWith(kPlaceholderPrefix)) {
      // the key to replace
      const key = name.substring(kPlaceholderPrefix.length);
      if (data[key]) {
        return data[key];
      }
    } else {
      return undefined;
    }
  };

  // Find any paths that contain a placeholder and rename them
  const pathsToRename = [];
  for (
    const walk of walkSync(target)
  ) {
    if (walk.isDirectory) {
      const newName = renamed(walk.name, data);
      if (newName) {
        pathsToRename.unshift({
          from: walk.path,
          to: join(dirname(walk.path), newName),
        });
      }
    } else {
      const filenameNoExt = basename(walk.name, extname(walk.name));
      const newName = renamed(filenameNoExt, data);
      if (newName) {
        pathsToRename.unshift({
          from: walk.path,
          to: join(
            dirname(walk.path),
            `${newName}${extname(walk.name)}`,
          ),
        });
      }
    }
  }

  for (const folder of pathsToRename) {
    Deno.renameSync(folder.from, folder.to);
  }
}

// Render an ejs file to the output directory
const renderFile = (
  inputDir: string,
  src: string,
  outputDir: string,
  data: CreateDirectiveData,
) => {
  const srcFileName = basename(src);
  // The relative path within the output dir that should be used
  const relativeDir = dirname(relative(inputDir, src));

  // The target file name
  const targetFileName = srcFileName.replace(/\.ejs\./, ".");

  // The render output target
  const renderTarget = join(outputDir, join(relativeDir, targetFileName));

  // Render the EJS
  const rendered = renderEjs(src, data, false);

  // Write the rendered EJS to the output file
  ensureDirSync(dirname(renderTarget));
  Deno.writeTextFileSync(renderTarget, rendered);
  return false;
};

const kPlaceholderPrefix = "extension-";

function templateFolder(createDirective: CreateDirective) {
  const basePath = resourcePath(join("create", "extensions"));
  const artifactFolderName = createDirective.template.replace(":", "-");
  return join(basePath, artifactFolderName);
}

interface CreateDirectiveData extends Record<string, string> {
  name: string;
  filesafename: string;
  classname: string;
  title: string;
  author: string;
  version: string;
  quartoversion: string;
}

async function ejsData(
  createDirective: CreateDirective,
): Promise<CreateDirectiveData> {
  // Name variants
  const title = capitalizeTitle(createDirective.name);
  const classname = title.replaceAll(/[^\w]/gm, "");
  const filesafename = createDirective.name.replaceAll(
    /[^\w]/gm,
    "-",
  );

  // Other metadata
  const version = "1.0.0";
  const author = await gitAuthor() || "First Last";

  // Limit the quarto version to the major and minor version
  const qVer = coerce(quartoConfig.version());
  const quartoversion = `${qVer?.major}.${qVer?.minor}.0`;

  return {
    name: createDirective.name,
    filesafename,
    title,
    classname,
    author: author.trim(),
    version,
    quartoversion,
  };
}

async function gitAuthor() {
  const result = await execProcess({
    cmd: ["git", "config", "--global", "user.name"],
  });
  if (result.success) {
    return result.stdout;
  } else {
    return undefined;
  }
}
