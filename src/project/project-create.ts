/*
* project-create.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ld } from "lodash/mod.ts";
import { ensureDirSync, existsSync } from "fs/mod.ts";
import { basename, dirname, join } from "path/mod.ts";
import { info } from "log/mod.ts";

import { jupyterKernelspec } from "../core/jupyter/kernels.ts";
import { projectType } from "./types/project-types.ts";
import { renderEjs } from "../core/ejs.ts";

import { ExecutionEngine, executionEngine } from "../execute/engine.ts";

import { projectConfigFile } from "./project-context.ts";
import { createGitignore } from "./project-gitignore.ts";

export interface ProjectCreateOptions {
  dir: string;
  type: string;
  title: string;
  scaffold: boolean;
  engine: string;
  kernel?: string;
}

export async function projectCreate(options: ProjectCreateOptions) {
  // read and validate options
  options = await readOptions(options);

  // computed options
  const engine = executionEngine(options.engine);
  if (!engine) {
    throw Error(`Invalid execution engine: ${options.engine}`);
  }

  // track whether the directory already exists
  // (if so then don't scaffold)
  const dirAlreadyExists = existsSync(options.dir);
  if (!dirAlreadyExists) {
    ensureDirSync(options.dir);
  }

  options.dir = Deno.realPathSync(options.dir);
  info(`Creating project at `, { newline: false });
  info(`${options.dir}`, { bold: true, newline: false });
  info(":");

  // call create on the project type
  const projType = projectType(options.type);
  const projCreate = projType.create(options.title);

  // create the initial project config
  const quartoConfig = renderEjs(projCreate.configTemplate, {
    title: options.title,
    ext: engine.defaultExt,
  }, false);
  await Deno.writeTextFileSync(join(options.dir, "_quarto.yml"), quartoConfig);
  info(
    "- Created _quarto.yml",
    { indent: 2 },
  );
  await createGitignore(options.dir);
  info(
    "- Created .gitignore",
    { indent: 2 },
  );

  // create scaffold files if we aren't creating a project within the
  // current working directory (which presumably already has files)
  if (options.scaffold && projCreate.scaffold && !dirAlreadyExists) {
    for (const scaffold of projCreate.scaffold) {
      const md = projectMarkdownFile(
        options.dir,
        scaffold.name,
        scaffold.content,
        engine,
        options.kernel,
        scaffold.title,
        scaffold.format,
      );
      info("- Created " + md, { indent: 2 });
    }
  }

  // copy supporting files
  if (projCreate.supporting) {
    for (const supporting of projCreate.supporting) {
      const src = join(projCreate.resourceDir, supporting);
      const dest = join(options.dir, supporting);
      ensureDirSync(dirname(dest));
      Deno.copyFileSync(src, dest);
      info("- Created " + supporting, { indent: 2 });
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

  // provide default title
  options.title = options.title || basename(options.dir);

  // error if the quarto config file already exists
  if (projectConfigFile(options.dir)) {
    throw new Error(
      `The directory '${options.dir}' already contains a quarto project`,
    );
  }

  return options;
}

function projectMarkdownFile(
  dir: string,
  name: string,
  content: string,
  engine: ExecutionEngine,
  kernel?: string,
  title?: string,
  format?: string,
) {
  // yaml/title
  const lines: string[] = ["---"];
  if (title) {
    lines.push(`title: "${title}"`);
  }

  // format
  if (format) {
    lines.push(`format: ${format}`);
  }

  // write jupyter kernel if necessary
  lines.push(...engine.defaultYaml(kernel));

  // end yaml
  lines.push("---", "");

  // if there are only 3 lines then there was no title or jupyter entry, clear them
  if (lines.length === 3) {
    lines.splice(0, lines.length);
  }

  // content
  lines.push(content);

  // write file and return it's name
  name = name + engine.defaultExt;
  const path = join(dir, name);
  Deno.writeTextFileSync(path, lines.join("\n") + "\n");
  return name;
}
