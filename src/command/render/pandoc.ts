/*
* pandoc.ts
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

import { basename, dirname } from "path/mod.ts";
import { stringify } from "encoding/yaml.ts";

import { execProcess, ProcessResult } from "../../core/process.ts";
import { message } from "../../core/console.ts";

import { RenderFlags } from "./flags.ts";
import { PandocDefaults } from "../../config/config.ts";

// options required to run pandoc
export interface PandocOptions {
  // input file
  input: string;
  // metadata for target format
  format: PandocDefaults;
  // command line args for pandoc
  args: string[];
  // command line flags (e.g. could be
  // used to specify a pdf or bib engine)
  flags?: RenderFlags;
}

export async function runPandoc(
  options: PandocOptions,
): Promise<ProcessResult> {
  // build the pandoc command
  const cmd = ["pandoc", basename(options.input)];

  // write a temporary default file from the options
  const yaml = "---\n" + stringify(options.format);
  const yamlFile = await Deno.makeTempFile(
    { prefix: "quarto-defaults", suffix: ".yml" },
  );
  await Deno.writeTextFile(yamlFile, yaml);
  cmd.push("--defaults", yamlFile);

  // build command line args
  const args = [...options.args];

  // add citeproc if necessary
  const citeproc = citeMethod(options) === "citeproc";
  if (citeproc) {
    args.unshift("--citeproc");
  }

  // propagate quiet
  if (options.flags?.quiet) {
    args.push("--quiet");
  }

  // add user command line args
  cmd.push(...args);

  // print defaults file and command line args
  if (!options.flags?.quiet) {
    if (options.args.length > 0) {
      message(yaml + "args: " + args.join(" "));
    } else {
      message(yaml);
    }
    message("---\n");
  }

  // run pandoc
  return await execProcess({
    cmd,
    cwd: dirname(options.input),
  });
}

export type CiteMethod = "citeproc" | "natbib" | "biblatex";

export function citeMethod(
  options: PandocOptions,
): CiteMethod | null {
  return "citeproc";
}
