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
    message(`Creating project at `, { newline: false });
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
      "- Created shared metadata  (_quarto/metadata.yml)",
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
    const scaffolds: Record<string, string[]> = {};
    if (options.type === "default") {
      scaffolds[options.name!] = [options.name!, ""];
    } else if (options.type === "website") {
      scaffolds["index"] = [options.name!, "Hello, Website!"];
      scaffolds["about"] = ["About This Site", "More about this website."];
    } else if (options.type === "book") {
      scaffolds["01-intro"] = ["", "# Introduction {#sec:introduction}"];
      scaffolds["02-summary"] = ["", "# Summary {#sec:summary}"];
    }
    for (const scaffold of Object.keys(scaffolds)) {
      const [title, contents] = scaffolds[scaffold];
      const md = projectMarkdownFile(
        options.dir,
        scaffold,
        contents,
        options.scaffold,
        title,
      );
      if (!options.quiet) {
        message("- Created " + md, { indent: 2 });
      }
    }
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

  // validate output-dir
  if (options.type === "default" && options[kOutputDir]) {
    throw new Error("Default project type cannot specify an output-dir");
  }

  // provide default output-dir
  if (!options[kOutputDir]) {
    switch (options.type) {
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

function projectMarkdownFile(
  dir: string,
  name: string,
  content: string,
  type: string[],
  title?: string,
) {
  // yaml/title
  const lines: string[] = ["---"];
  if (title) {
    lines.push(`title: "${title}"`);
  }

  // write jupyter kernel if necessary
  if (type[0] === "jupyter") {
    lines.push(`jupyter: ${type[1]}`);
  }

  // end yaml
  lines.push("---", "");

  // if there are only 3 lines then there was no title or jupyter entry, clear them
  if (lines.length === 3) {
    lines.splice(0, lines.length);
  }

  // content
  lines.push(content);

  // write file and return it's name
  name = name + (type[0] === "rmd" ? ".Rmd" : ".md");
  const path = join(dir, name);
  Deno.writeTextFileSync(path, lines.join("\n") + "\n");
  return name;
}

function quartoDir(dir: string) {
  return join(dir, "_quarto");
}
