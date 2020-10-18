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

import type { FormatPandoc } from "../../api/format.ts";

import { execProcess, ProcessResult } from "../../core/process.ts";
import { consoleWriteLine } from "../../core/console.ts";

import { Metadata, metadataFromFile } from "../../config/metadata.ts";
import { PdfEngine, pdfEngine } from "../../config/pdf.ts";
import { mergeConfigs } from "../../config/config.ts";

import { RenderFlags } from "./flags.ts";

// options required to run pandoc
export interface PandocOptions {
  // input file
  input: string;
  // metadata for target format
  format: FormatPandoc;
  // command line args for pandoc
  args: string[];
  // command line flags (e.g. could be
  // used to specify a pdf or bib engine)
  flags?: RenderFlags;
  // quiet mode?
  quiet?: boolean;
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

  // add citeproc if necessary
  const citeproc = citeMethod(options) === "citeproc";
  if (citeproc) {
    cmd.push("--citeproc");
  }

  // add user command line args
  cmd.push(...options.args);

  // print defaults file and command line args
  if (!options.quiet) {
    if (options.args.length > 0) {
      consoleWriteLine(yaml + "args: " + options.args.join(" "));
    } else {
      consoleWriteLine(yaml);
    }
    consoleWriteLine("---\n");
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
  const metadata = pandocMetadata(options.input, options.format);
  const pdf = pdfEngine(metadata, options.flags);

  // no handler if no references
  if (!metadata.bibliography && !metadata.references) {
    return null;
  }

  // if it's pdf-based output check for natbib or biblatex
  if (pdf?.bibEngine) {
    return pdf.bibEngine;
  }

  // otherwise it's citeproc unless expressly disabled
  if (metadata.citeproc !== false) {
    return "citeproc";
  } else {
    return null;
  }
}

export function pandocMetadata(file: string, format?: FormatPandoc): Metadata {
  // get all metadata from the input file
  const inputMetadata = metadataFromFile(file);

  // derive 'final' metadata by merging the intputMetadata intot the format definition
  return mergeConfigs(format || {}, inputMetadata);
}
