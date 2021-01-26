/*
* create-project.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ld } from "lodash/mod.ts";
import { ensureDirSync, existsSync } from "fs/mod.ts";

import { basename, join } from "path/mod.ts";
import { jupyterKernelspec } from "../../core/jupyter/kernels.ts";
import { pandocListFormats } from "../../core/pandoc/pandoc-formats.ts";
import { message } from "../../core/console.ts";

export const kOutputDir = "output-dir";

export interface CreateProjectOptions {
  dir: string;
  type: "default" | "website" | "book";
  formats?: string[];
  scaffold: string[] | false;
  name?: string;
  [kOutputDir]?: string;
  quiet?: boolean;
}

export async function createProject(
  options: CreateProjectOptions,
) {
  // read and validate options
  options = await readOptions(options);

  ensureDirSync(options.dir);
  options.dir = Deno.realPathSync(options.dir);
  if (!options.quiet) {
    message(`Creating quarto project at `, { newline: false });
    message(`${options.dir}`, { bold: true, newline: false });
    message(":");
  }

  // create the quarto dir
  const projDir = quartoDir(options.dir);
  ensureDirSync(projDir);
  if (!options.quiet) {
    message("- Created project config directory (_quarto)", { indent: 2 });
  }

  // create the initial metadata file
  const metadata = projectMetadataFile(options);
  await Deno.writeTextFile(join(projDir, "metadata.yml"), metadata);
  if (!options.quiet) {
    message(
      "- Created project metadata (_quarto/metadata.yml)",
      { indent: 2 },
    );
  }

  // create the .gitignore file
  const gitignore = ".quarto\n.DS_Store\n";
  await Deno.writeTextFile(join(projDir, ".gitignore"), gitignore);
  if (!options.quiet) {
    message(
      "- Created config gitignore (_quarto/.gitignore)",
      { indent: 2 },
    );
  }

  // create scaffold if requested
  if (options.scaffold) {
    //
  }
}

// validate and potentialy provide some defaults
async function readOptions(options: CreateProjectOptions) {
  options = ld.cloneDeep(options);

  // validate formats
  if (options.formats) {
    const validFormats = await pandocListFormats();
    const invalid = ld.difference(options.formats, validFormats);
    if (invalid.length > 0) {
      throw new Error(
        `The following formats are invalid: ${invalid.join(", ")}`,
      );
    }
  }

  // validate/complete scaffold if it's jupyter
  if (Array.isArray(options.scaffold) && options.scaffold[0] === "jupyter") {
    const kernel = options.scaffold[1];
    const kernelspec = await jupyterKernelspec(kernel);
    if (!kernelspec) {
      throw new Error(
        `Specified jupyter kernel ('${kernel}') not found.`,
      );
    }
  }

  // provide default name
  options.name = options.name || basename(options.dir);

  // provide default output-dir
  if (!options[kOutputDir]) {
    switch (options.type) {
      case "default":
        options[kOutputDir] = ".";
        break;
      case "website":
        options[kOutputDir] = "_site";
        break;
      case "book":
        options[kOutputDir] = "_book";
        break;
    }
  }

  // error if the quartoDir already exists
  if (existsSync(quartoDir(options.dir))) {
    throw new Error(
      `The directory '${options.dir}' already contains a quarto project`,
    );
  }

  return options;
}

function projectMetadataFile(options: CreateProjectOptions) {
  // build lines
  const lines: string[] = [];
  const addLine = (line: string, indent = 0) => {
    lines.push(" ".repeat(indent * 2) + line);
  };

  // main metadata
  addLine("project:");
  addLine(`name: ${options.name}`, 1);
  if (options.type !== "default") {
    addLine(`type: ${options.type}`, 1);
    addLine(`output-dir: ${options[kOutputDir]}`, 1);
  }

  // format
  if (options.formats) {
    addLine("format:");
    for (const format of options.formats) {
      addLine(`${format}: default`, 1);
    }
  }

  return lines.join("\n") + "\n";
}

function quartoDir(dir: string) {
  return join(dir, "_quarto");
}
