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

import { Config, Format } from "../../config/config.ts";
import { pdfEngine } from "../../config/pdf.ts";

import { RenderFlags } from "./flags.ts";

// options required to run pandoc
export interface PandocOptions {
  // input file
  input: string;
  // full merged config
  config: Config;
  // target format
  format: Format;
  // command line args for pandoc
  args: string[];
  // command line flags (e.g. could be used
  // to specify e.g. quiet or pdf engine)
  flags?: RenderFlags;
}

export async function runPandoc(
  options: PandocOptions,
): Promise<ProcessResult> {
  // build the pandoc command
  const cmd = ["pandoc", basename(options.input)];

  // write a temporary defaults file
  let yaml = "";
  if (options.format.defaults) {
    yaml = "---\n" + stringify(options.format.defaults);
    const yamlFile = await Deno.makeTempFile(
      { prefix: "quarto-defaults", suffix: ".yml" },
    );
    await Deno.writeTextFile(yamlFile, yaml);
    cmd.push("--defaults", yamlFile);
  }

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
  // collect config
  const pdf = pdfEngine(options.format.defaults, options.flags);

  // no handler if no references
  if (!options.config.bibliography && !options.config.references) {
    return null;
  }

  // if it's pdf-based output check for natbib or biblatex
  if (pdf?.bibEngine) {
    return pdf.bibEngine;
  }

  // otherwise it's citeproc unless expressly disabled
  if (options.config.citeproc !== false) {
    return "citeproc";
  } else {
    return null;
  }
}
