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

import { extname } from "path/mod.ts";
import { getenv } from "../core/env.ts";
import { execProcess } from "../core/process.ts";
import { resourcePath } from "../core/resources.ts";
import { readYamlFromMarkdown } from "../core/yaml.ts";

import { Metadata } from "../config/metadata.ts";

import type {
  ComputationEngine,
  ExecuteOptions,
  ExecuteResult,
  PostProcessOptions,
} from "./engine.ts";

export const ipynbEngine: ComputationEngine = {
  name: "ipynb",

  canHandle: (file: string) => {
    // if it's an .Rmd or .md file, then read the YAML to see if has jupytext,
    // if it does, check for paired paths

    // if it's a .py file, then check for paired paths

    // if it's an .ipynb file, then check for paired paths and use --sync

    return [".ipynb"].includes(extname(file).toLowerCase());
  },

  metadata: async (file: string): Promise<Metadata> => {
    const decoder = new TextDecoder("utf-8");
    const ipynbContents = await Deno.readFile(file);
    const ipynb = JSON.parse(decoder.decode(ipynbContents));
    const cells = ipynb.cells as Array<{ cell_type: string; source: string[] }>;
    const markdown = cells.reduce((md, cell) => {
      if (cell.cell_type === "markdown") {
        return md + "\n" + cell.source.join("");
      } else {
        return md;
      }
    }, "");

    return readYamlFromMarkdown(markdown);
  },

  execute: async (options: ExecuteOptions): Promise<ExecuteResult> => {
    const condaPrefix = getenv("CONDA_PREFIX");
    const result = await execProcess({
      cmd: [
        condaPrefix + "/bin/python",
        resourcePath("ipynb.py"),
        options.input,
        options.output,
      ],
      stdout: "piped",
    });

    if (result.success) {
      return JSON.parse(result.stdout!);
    } else {
      return Promise.reject();
    }
  },

  postprocess: async (options: PostProcessOptions) => {
  },
};
