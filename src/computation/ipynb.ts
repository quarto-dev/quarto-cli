/*
* ipynb.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
* Unless you have received this program directly from RStudio pursuant
* to the terms of a commercial license agreement with RStudio, then
* this program is licensed to you under the terms of version 3 of the
* GNU General Public License. This program is distributed WITHOUT
* ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
* MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
* GPL (http://www.gnu.org/licenses/gpl-3.0.txt) for more details.
*
*/

import { extname, join } from "path/mod.ts";
import { getenv } from "../core/env.ts";
import { execProcess } from "../core/process.ts";
import { resourcePath } from "../core/resources.ts";
import {
  readYamlFromMarkdown,
  readYamlFromMarkdownFile,
} from "../core/yaml.ts";

import { Metadata } from "../config/metadata.ts";

import type {
  ComputationEngine,
  ExecuteOptions,
  ExecuteResult,
  PostProcessOptions,
} from "./engine.ts";
import { dirAndStem } from "../core/path.ts";
import { json } from "https://deno.land/std@0.71.0/encoding/_yaml/schema/json.ts";
import { basename, dirname } from "https://deno.land/std@0.71.0/path/win32.ts";

const kNotebookExtensions = [
  ".ipynb",
];
const kJupytextMdExtensions = [
  ".Rmd",
  ".md",
  ".markdown",
];
const kCodeExtensions = [
  ".py",
  ".jl",
  ".R",
  ".r",
  ".clj",
  ".js",
  ".ts",
  ".cs",
  ".java",
  ".groovy",
];

export const ipynbEngine: ComputationEngine = {
  name: "ipynb",

  handle: async (file: string) => {
    const notebookTarget = async () => {
      // if it's an .Rmd or .md file, then read the YAML to see if has jupytext,
      // if it does, check for a paired notebook and return it
      const ext = extname(file);
      if (kJupytextMdExtensions.includes(ext)) {
        if (isJupytextMd(file)) {
          return { sync: true, notebook: await pairedNotebook(file) };
        }
      } // if it's a code file, then check for a paired notebook and return it
      else if (kCodeExtensions.includes(ext)) {
        return { sync: true, notebook: await pairedNotebook(file) };
        // if it's a notebook file then return it
      } else if (isNotebook(file)) {
        const paired = pairedPaths(file);
        return { sync: !!(await pairedPaths(file)).length, notebook: file };
      }
    };

    // see if there is a notebook target, if there is then sync it if required and return
    const target = await notebookTarget();
    if (target && target.notebook) {
      if (target.sync) {
        const args = ["--sync", target.notebook];
        await jupytext(...args);
      }
      return target.notebook;
    }
  },

  metadata: async (input: string): Promise<Metadata> => {
    // read metadata
    const decoder = new TextDecoder("utf-8");
    const ipynbContents = await Deno.readFile(input);
    const ipynb = JSON.parse(decoder.decode(ipynbContents));
    const cells = ipynb.cells as Array<{ cell_type: string; source: string[] }>;
    const markdown = cells.reduce((md, cell) => {
      if (["markdown", "raw"].includes(cell.cell_type)) {
        return md + "\n" + cell.source.join("");
      } else {
        return md;
      }
    }, "");

    return readYamlFromMarkdown(markdown);
  },

  execute: async (options: ExecuteOptions): Promise<ExecuteResult> => {
    // jupytext execute before converting to markdown
    const args = ["--execute", "--sync", options.input];
    if (options.quiet) {
      args.push("--quiet");
    }
    await jupytext(...args);

    // convert to markdown
    const result = await execProcess(
      {
        cmd: [
          pythonBinary(),
          resourcePath("ipynb.py"),
        ],
        stdout: "piped",
      },
      JSON.stringify(options),
    );

    if (result.success) {
      return JSON.parse(result.stdout!);
    } else {
      return Promise.reject();
    }
  },

  postprocess: async (options: PostProcessOptions) => {
  },

  keepMd: (input: string) => {
    return join(dirname(input), basename(input) + ".md");
  },
};

async function isJupytextMd(file: string) {
  const yaml = readYamlFromMarkdownFile(file);
  return yaml instanceof Object &&
    yaml.jupyter instanceof Object &&
    Object.keys(yaml.jupyter).includes("jupytext");
}

async function pairedPaths(file: string) {
  const result = await execProcess({
    cmd: [
      pythonBinary("jupytext"),
      "--paired-paths",
      file,
    ],
    stdout: "piped",
  });
  if (result.stdout) {
    return result.stdout.split(/\r?\n/);
  } else {
    return [];
  }
}

async function pairedNotebook(file: string) {
  const paired = await pairedPaths(file);
  if (paired) {
    return paired.find(isNotebook);
  } else {
    return undefined;
  }
}

function isNotebook(file: string) {
  return kNotebookExtensions.includes(extname(file).toLowerCase());
}

function pythonBinary(binary = "python") {
  const condaPrefix = getenv("CONDA_PREFIX");
  return condaPrefix + "/bin/" + binary;
}

async function jupytext(...args: string[]) {
  const result = await execProcess(
    {
      cmd: [
        pythonBinary("jupytext"),
        ...args,
      ],
    },
    undefined,
    (data: Uint8Array) => {
      Deno.stderr.writeSync(data);
    },
  );
  if (!result.success) {
    throw new Error(result.stderr || "Error syncing jupytext");
  }
}
