/*
* project-create.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ld } from "lodash/mod.ts";
import { ensureDirSync, existsSync } from "fs/mod.ts";
import { basename, join } from "path/mod.ts";
import { stringify } from "encoding/yaml.ts";

import { jupyterKernelspec } from "../core/jupyter/kernels.ts";
import { message } from "../core/console.ts";
import { ProjectCreate, projectType } from "./types/project-types.ts";
import { mergeConfigs } from "../core/config.ts";

import { kOutputDir, projectConfigDir } from "../config/project.ts";

export interface ProjectCreateOptions {
  dir: string;
  type?: string;
  name?: string;
  [kOutputDir]?: string;
  engine?: string;
  kernel?: string;
  quiet?: boolean;
}

export async function projectCreate(options: ProjectCreateOptions) {
  // read and validate options
  options = await readOptions(options);

  // track whether the directory already exists
  // (if so then don't scaffold)
  const dirAlreadyExists = existsSync(options.dir);
  if (!dirAlreadyExists) {
    ensureDirSync(options.dir);
  }

  options.dir = Deno.realPathSync(options.dir);
  if (!options.quiet) {
    message(`Creating project at `, { newline: false });
    message(`${options.dir}`, { bold: true, newline: false });
    message(":");
  }

  // create the quarto dir
  const projDir = projectConfigDir(options.dir);
  ensureDirSync(projDir);
  if (!options.quiet) {
    message("- Created project config directory (_quarto)", { indent: 2 });
  }

  // call create on the project type
  const projType = projectType(options.type);
  const projCreate = projType.create(options.name!);

  // create the initial metadata file
  const metadata = projectMetadataFile(options, projCreate);
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

  // create scaffold files if we aren't creating a project within the
  // current working directory (which presumably already has files)
  if (projCreate.scaffold && !dirAlreadyExists) {
    for (const scaffold of projCreate.scaffold) {
      const md = projectMarkdownFile(
        options.dir,
        scaffold.name,
        scaffold.content,
        options.engine || "markdown",
        options.kernel,
        scaffold.title,
      );
      if (!options.quiet) {
        message("- Created " + md, { indent: 2 });
      }
    }
  }

  // copy supporting files
  if (projCreate.supporting) {
    for (const supporting of projCreate.supporting) {
      const name = basename(supporting);
      Deno.copyFileSync(supporting, join(options.dir, name));
      if (!options.quiet) {
        message("- Created " + name, { indent: 2 });
      }
    }
  }
}

// validate and potentialy provide some defaults
async function readOptions(options: ProjectCreateOptions) {
  options = ld.cloneDeep(options);

  // validate/complete engine if it's jupyter
  if (options.engine === "jupyter") {
    const kernel = options.kernel || "python3";
    const kernelspec = await jupyterKernelspec(kernel);
    if (!kernelspec) {
      throw new Error(
        `Specified jupyter kernel ('${kernel}') not found.`,
      );
    }
  }

  // provide default name
  options.name = options.name || basename(options.dir);

  // no output-dir for default type
  if (options[kOutputDir] && options.type === "default") {
    throw new Error(
      "You canont specify ---output-dir for the default project type.",
    );
  }

  // provide default output-dir
  if (!options[kOutputDir]) {
    switch (options.type) {
      case "book":
        options[kOutputDir] = "_book";
        break;
    }
  }

  // error if the quartoDir already exists
  if (existsSync(projectConfigDir(options.dir))) {
    throw new Error(
      `The directory '${options.dir}' already contains a quarto project`,
    );
  }

  return options;
}

function projectMetadataFile(
  options: ProjectCreateOptions,
  projCreate: ProjectCreate,
) {
  // deno-lint-ignore no-explicit-any
  let metadata: any = {
    project: {
      name: options.name,
    },
  };
  if (options.type !== "default") {
    metadata.project.type = options.type;
    metadata.project[kOutputDir] = options[kOutputDir];
  }

  // merge project metadata
  metadata = mergeConfigs(metadata, projCreate.metadata);

  // move project level metadata to the bottom
  const project = ld.cloneDeep(metadata.project);
  delete metadata.project;
  metadata.project = project;

  // convert to yaml
  return stringify(metadata, { indent: 2, sortKeys: false });
}

function projectMarkdownFile(
  dir: string,
  name: string,
  content: string,
  engine: string,
  kernel?: string,
  title?: string,
) {
  // yaml/title
  const lines: string[] = ["---"];
  if (title) {
    lines.push(`title: "${title}"`);
  }

  // write jupyter kernel if necessary
  if (engine === "jupyter") {
    lines.push(`jupyter: ${kernel}`);
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
  name = name + (engine === "rmd" ? ".Rmd" : ".md");
  const path = join(dir, name);
  Deno.writeTextFileSync(path, lines.join("\n") + "\n");
  return name;
}
