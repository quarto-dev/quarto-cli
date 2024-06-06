/*
 * project-create.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import * as ld from "../core/lodash.ts";
import { ensureDirSync, existsSync } from "fs/mod.ts";
import { basename, dirname, join } from "../deno_ral/path.ts";
import { info } from "../deno_ral/log.ts";

import { jupyterKernelspec } from "../core/jupyter/kernels.ts";
import {
  jupyterCreateCondaenv,
  jupyterCreateVenv,
} from "../core/jupyter/venv.ts";

import { projectType } from "./types/project-types.ts";
import { renderEjs } from "../core/ejs.ts";

import { executionEngine } from "../execute/engine.ts";
import { ExecutionEngine } from "../execute/types.ts";

import { projectConfigFile } from "./project-shared.ts";
import { ensureGitignore } from "./project-gitignore.ts";
import { kWebsite } from "./types/website/website-constants.ts";
import { copyTo } from "../core/copy.ts";
import { normalizePath } from "../core/path.ts";

export interface ProjectCreateOptions {
  dir: string;
  type: string;
  title: string;
  scaffold: boolean;
  engine: string;
  kernel?: string;
  editor?: string;
  venv?: boolean;
  condaenv?: boolean;
  envPackages?: string[];
  template?: string;
  quiet?: boolean;
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

  options.dir = normalizePath(options.dir);
  if (!options.quiet) {
    info(`Creating project at `, { newline: false });
    info(`${options.dir}`, { bold: true, newline: false });
    info(":");
  }

  // 'website' used to be 'site'
  if (options.type === "site") {
    options.type = kWebsite;
  }

  // call create on the project type
  const projType = projectType(options.type);
  const projCreate = projType.create(options.title, options.template);

  // create the initial project config
  const quartoConfig = renderEjs(projCreate.configTemplate, {
    title: options.title,
    editor: options.editor,
    ext: engine.defaultExt,
  }, false);
  Deno.writeTextFileSync(join(options.dir, "_quarto.yml"), quartoConfig);
  if (!options.quiet) {
    info(
      "- Created _quarto.yml",
      { indent: 2 },
    );
  }
  if (
    await ensureGitignore(options.dir, !!options.venv || !!options.condaenv) &&
    !options.quiet
  ) {
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
        options.envPackages,
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
        scaffold.yaml,
        scaffold.subdirectory,
        scaffold.supporting,
      );
      if (md && !options.quiet) {
        info("- Created " + md, { indent: 2 });
      }
    }
  }

  // copy supporting files
  if (projCreate.supporting) {
    for (const supporting of projCreate.supporting) {
      let src;
      let dest;
      let displayName;
      if (typeof supporting === "string") {
        src = join(projCreate.resourceDir, supporting);
        dest = join(options.dir, supporting);
        displayName = supporting;
      } else {
        src = join(projCreate.resourceDir, supporting.from);
        dest = join(options.dir, supporting.to);
        displayName = supporting.to;
      }
      if (!existsSync(dest)) {
        ensureDirSync(dirname(dest));
        copyTo(src, dest);
        if (!options.quiet) {
          info("- Created " + displayName, { indent: 2 });
        }
      }
    }
  }

  // create venv if requested
  if (options.venv) {
    await jupyterCreateVenv(options.dir, options.envPackages);
  } else if (options.condaenv) {
    await jupyterCreateCondaenv(options.dir, options.envPackages);
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
  yaml?: string,
  subdirectory?: string,
  supporting?: string[],
): string | undefined {
  // yaml/title
  const lines: string[] = ["---"];
  if (title) {
    lines.push(`title: "${title}"`);
  }

  if (yaml) {
    lines.push(yaml);
  }

  // write jupyter kernel if necessary
  if (!noEngineContent) {
    lines.push(...engine.defaultYaml(kernel));
  }

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
  name = (name + engine.defaultExt).toLocaleLowerCase();

  const ensureSubDir = (dir: string, name: string, subdirectory?: string) => {
    if (subdirectory) {
      const newDir = join(dir, subdirectory);
      ensureDirSync(newDir);
      return join(newDir, name);
    } else {
      return join(dir, name);
    }
  };

  const path = ensureSubDir(dir, name, subdirectory);
  if (!existsSync(path)) {
    Deno.writeTextFileSync(path, lines.join("\n") + "\n");

    // Write supporting files
    supporting?.forEach((from) => {
      const name = basename(from);
      const target = join(dirname(path), name);
      copyTo(from, target);
    });

    return subdirectory ? join(subdirectory, name) : name;
  } else {
    return undefined;
  }
}
