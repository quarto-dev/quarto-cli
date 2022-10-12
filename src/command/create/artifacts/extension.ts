/*
* extension.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

// import { executionEngine, executionEngines } from "../../../execute/engine.ts";

import { ArtifactCreator, CreateContext, CreateDirective } from "../cmd.ts";
import { join, relative } from "path/mod.ts";

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
import { texSafeFilename } from "../../../core/tex.ts";
import { renderEjs } from "../../../core/ejs.ts";
import { ensureDirSync, walkSync } from "fs/mod.ts";

const kType = "type";
const kSubType = "subtype";
const kName = "name";

const kTypeExtension = "extension";

const kExtensionTypes = [
  { name: "filter", value: "filter" },
  { name: "revealjs plugin", value: "revealjs-plugin" },
  { name: "shortcode", value: "shortcode" },
  "---",
  { name: "journal article format", value: "journal" },
  { name: "custom format", value: "format" },
  "---",
  { name: "project", value: "project" },
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

function createArtifact(createDirective: CreateDirective) {
  console.log(createDirective);
  copyArtifact(createDirective);
  return Promise.resolve(createDirective.directory);
}

function copyArtifact(createDirective: CreateDirective) {
  const artifact = templateFolder(createDirective);
  const target = createDirective.directory;
  const data = ejsData(createDirective);

  ensureDirSync(target);

  copyMinimal(
    artifact,
    createDirective.directory,
    undefined,
    (src: string) => {
      const srcFileName = basename(src);
      if (srcFileName.includes(".ejs.")) {
        // Render the ejs instead
        const relativeDir = dirname(relative(artifact, src));
        const targetFileName = srcFileName.replace(".ejs.", ".");

        const renderTarget = join(target, join(relativeDir, targetFileName));
        const rendered = renderEjs(src, data, false);
        ensureDirSync(dirname(renderTarget));
        Deno.writeTextFileSync(renderTarget, rendered);
        return false;
      } else {
        return true;
      }
    },
  );

  const pathsToRename = [];
  for (
    const walk of walkSync(target)
  ) {
    if (walk.isDirectory && walk.name === "8E7F6E97") {
      pathsToRename.unshift({
        from: walk.path,
        to: join(dirname(walk.path), texSafeFilename(createDirective.name)),
      });
    } else if (walk.isFile) {
      const base = basename(walk.name, extname(walk.name));
      if (base === "8E7F6E97") {
        pathsToRename.unshift({
          from: walk.path,
          to: join(
            dirname(walk.path),
            `${texSafeFilename(createDirective.name)}${extname(walk.name)}`,
          ),
        });
      }
    }
  }

  for (const folder of pathsToRename) {
    Deno.renameSync(folder.from, folder.to);
  }
}

function templateFolder(createDirective: CreateDirective) {
  const basePath = resourcePath(join("create", "extensions"));
  const artifactFolderName = createDirective.template.replace(":", "-");
  return join(basePath, artifactFolderName);
}

function ejsData(createDirective: CreateDirective) {
  return {
    title: capitalizeTitle(createDirective.name),
    name: createDirective.name,
    author: "Norah Jones",
    version: "1.0.0",
    fileSafeName: texSafeFilename(createDirective.name),
    quartoVersion: quartoConfig.version(),
  };
}
