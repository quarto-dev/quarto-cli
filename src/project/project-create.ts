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
import { jupyterCreateVenv } from "../core/jupyter/venv.ts";

import { projectType } from "./types/project-types.ts";
import { renderEjs } from "../core/ejs.ts";

import { executionEngine } from "../execute/engine.ts";
import { ExecutionEngine } from "../execute/types.ts";

import { projectConfigFile } from "./project-shared.ts";
import { ensureGitignore } from "./project-gitignore.ts";

export interface ProjectCreateOptions {
  dir: string;
  type: string;
  title: string;
  scaffold: boolean;
  engine: string;
  kernel?: string;
  venv?: boolean;
  venvPackages?: string[];
}

export async function projectCreate(options: ProjectCreateOptions) {
  // read and validate options
  options = await readOptions(options);

  // computed options
  const engine = executionEngine(options.engine);
  if (!engine) {
    throw Error(`Invalid execution engine: ${options.engine}`);
  }

  // ensure that the directory exists
  ensureDirSync(options.dir);

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
  if (await ensureGitignore(options.dir, !!options.venv)) {
    info(
      "- Created .gitignore",
      { indent: 2 },
    );
  }

  // create scaffold files if we aren't creating a project within the
  // current working directory (which presumably already has files)
  if (options.scaffold && projCreate.scaffold) {
    for (
      const scaffold of projCreate.scaffold(
        options.engine,
        options.kernel,
        options.venvPackages,
      )
    ) {
      const md = projectMarkdownFile(
        options.dir,
        scaffold.name,
        scaffold.content,
        engine,
        options.kernel,
        scaffold.title,
        scaffold.noEngineContent,
      );
      if (md) {
        info("- Created " + md, { indent: 2 });
      }
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

  // create venv if requested
  if (options.venv) {
    await jupyterCreateVenv(options.dir, options.venvPackages);
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
  } else {
    // error to create a venv outside of jupyter
    if (options.venv) {
      throw new Error("You can only use --with-venv with the jupyter engine");
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
  noEngineContent?: boolean,
): string | undefined {
  // yaml/title
  const lines: string[] = ["---"];
  if (title) {
    lines.push(`title: "${title}"`);
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

  // see if the engine has defautl content
  if (!noEngineContent) {
    const engineContent = engine.defaultContent(kernel);
    if (engineContent.length > 0) {
      lines.push("");
      lines.push(...engineContent);
    }
  }

  // write file and return it's name
  name = name + engine.defaultExt;
  const path = join(dir, name);
  if (!existsSync(path)) {
    Deno.writeTextFileSync(path, lines.join("\n") + "\n");
    return name;
  } else {
    return undefined;
  }
}
