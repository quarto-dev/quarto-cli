/*
 * container.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { walkSync } from "../vendor/deno.land/std@0.185.0/fs/walk.ts";

import { basename, join } from "path/mod.ts";
import { existsSync } from "fs/mod.ts";

// REES Compatible execution files
// from https://repo2docker.readthedocs.io/en/latest/config_files.html#config-files
const kExecutionFiles = [
  "environment.yml",
  "requirements.txt",
  "renv.lock", // not supported by repo2docker
  "Pipfile",
  "Pipfile.lock",
  "setup.py",
  "Project.toml",
  "REQUIRE",
  "install.R",
  "apt.txt",
  "DESCRIPTION",
  "postBuild",
  "start",
  "runtime.txt",
  "default.nix",
  "Dockerfile",
];

export function isReesEnvronmentFile(path: string) {
  return kExecutionFiles.includes(basename(path));
}

export function codeSpacesUrl(repoUrl: string) {
  // https://github.com/Notebooks-Now/submission-quarto-full/
  // transforms to:
  // https://github.com/codespaces/new/Notebooks-Now/submission-quarto-full

  const containerUrl = repoUrl.replace(
    /(https?\:\/\/github.com)\/([a-zA-Z0-9-_\.]+?)\/([a-zA-Z0-9-_\.]+?)\//,
    "$1/codespaces/new/$2/$3?resume=1",
  );
  return containerUrl;
}

export interface BinderOptions {
  openFile?: string;
  editor?: "vscode" | "rstudio" | "jupyterlab";
}

export function binderUrl(
  organization: string,
  repository: string,
  binderOptions?: BinderOptions,
) {
  // https://github.com/Notebooks-Now/submission-quarto-lite
  // https://mybinder.org/v2/gh/Notebooks-Now/submission-quarto-lite/HEAD?labpath=article.ipynb
  const url = [`https://mybinder.org/v2/gh/${organization}/${repository}/HEAD`];
  const params = [];
  if (binderOptions && binderOptions.openFile) {
    params.push(`labpath=${binderOptions.openFile}`);
  }

  if (binderOptions?.editor) {
    switch (binderOptions.editor) {
      case "rstudio":
        params.push(`urlpath=rstudio`);
        break;
      case "vscode":
        params.push(`urlpath=vscode`);
        break;
      case "jupyterlab":
      default:
        break;
    }
  }

  // Add any parameters
  if (params.length > 0) {
    url.push("?");
    url.push(params.join("&"));
  }

  return url.join("");
}

export function isDevContainerFile(relPath: string) {
  if (relPath === join(".devcontainer", "devcontainer.json")) {
    return true;
  }

  if (relPath === ".devcontainer.json") {
    return true;
  }

  if (relPath.match(/^\.devcontainer[\/\\][^\/\\]+?[\/\\]devcontainer.json$/)) {
    return true;
  }

  return false;
}

// Are there binder compatible environments defined
export function hasBinderCompatibleEnvironment(dir: string) {
  for (const executionFile of kExecutionFiles) {
    if (existsSync(join(dir, executionFile))) {
      return true;
    }
  }
  return false;
}

export function hasDevContainer(dir: string) {
  // Devcontainer file in a hidden subdirectory
  if (existsSync(join(dir, ".devcontainer", "devcontainer.json"))) {
    return true;
  }

  // Devcontainer file in the root
  if (existsSync(join(dir, ".devcontainer.json"))) {
    return true;
  }

  // Devcontainer in a direct subdirectory child
  const containerRootDir = join(dir, ".devcontainer");
  if (existsSync(containerRootDir)) {
    for (
      const walk of walkSync(containerRootDir, {
        maxDepth: 1,
        includeFiles: false,
        includeDirs: true,
      })
    ) {
      if (existsSync(join(containerRootDir, walk.name, "devcontainer.json"))) {
        return true;
      }
    }
  }

  return false;
}
