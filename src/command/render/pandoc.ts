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

import { dirname } from "path/mod.ts";
import { stringify } from "encoding/yaml.ts";

import { execProcess, ProcessResult } from "../../core/process.ts";
import { message } from "../../core/console.ts";

import { Format, FormatPandoc } from "../../config/format.ts";
import { pdfEngine } from "../../config/pdf.ts";
import { Metadata } from "../../config/metadata.ts";

import { RenderFlags } from "./flags.ts";
import {
  kBibliography,
  kFrom,
  kIncludeAfterBody,
  kIncludeBeforeBody,
  kIncludeInHeader,
  kOutputFile,
  kSelfContained,
  kStandalone,
  kTemplate,
  kTo,
} from "../../config/constants.ts";

// options required to run pandoc
export interface PandocOptions {
  // input file
  input: string;
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
  // read the input file then append the metadata to the file (this is to that)
  // our fully resolved metadata, which incorporates project and format-specific
  // values, overrides the metadata contained within the file). we'll feed the
  // input to pandoc on stdin
  const input = Deno.readTextFileSync(options.input) +
    `\n---\n${stringify(options.format.metadata || {})}\n---\n`;

  // build the pandoc command (we'll feed it the input on stdin)
  const cmd = ["pandoc"];

  // write a temporary defaults file
  if (options.format.pandoc) {
    const defaults = "---\n" +
      stringify(options.format.pandoc as Record<string, unknown>);
    const defaultsFile = await Deno.makeTempFile(
      { prefix: "quarto-defaults", suffix: ".yml" },
    );
    await Deno.writeTextFile(defaultsFile, defaults);
    cmd.push("--defaults", defaultsFile);
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

  // print full resolved input to pandoc
  if (!options.flags?.quiet && options.format.metadata) {
    runPandocMessage(
      [options.input, ...args],
      options.format.pandoc,
      options.format.metadata,
    );
  }

  // run pandoc
  return await execProcess(
    {
      cmd,
      cwd: dirname(options.input),
    },
    input,
  );
}

type CiteMethod = "citeproc" | "natbib" | "biblatex";

function citeMethod(options: PandocOptions): CiteMethod | null {
  // no handler if no references
  const pandoc = options.format.pandoc;
  const metadata = options.format.metadata;
  if (!pandoc[kBibliography] && !metadata.references) {
    return null;
  }

  // collect config
  const pdf = pdfEngine(options.format.pandoc, options.flags);

  // if it's pdf-based output check for natbib or biblatex
  if (pdf?.bibEngine) {
    return pdf.bibEngine;
  }

  // otherwise it's citeproc unless expressly disabled
  if (pandoc.citeproc !== false) {
    return "citeproc";
  } else {
    return null;
  }
}

function runPandocMessage(
  args: string[],
  pandoc: FormatPandoc | undefined,
  metadata: Metadata,
  debug?: boolean,
) {
  message(`\npandoc ${args.join(" ")}`, { bold: true });
  if (pandoc) {
    message(pandocDefaultsMessage(pandoc, debug), { indent: 2 });
  }

  if (Object.keys(metadata).length > 0) {
    message("metadata:", { bold: true });
    const printMetadata = { ...metadata };
    delete printMetadata.format;
    message(stringify(printMetadata), { indent: 2 });
  }
}

function pandocDefaultsMessage(pandoc: FormatPandoc, debug?: boolean) {
  const kDebugOnly = [
    kIncludeInHeader,
    kIncludeBeforeBody,
    kIncludeAfterBody,
  ];
  const kOrder = [
    kTo,
    kFrom,
    kOutputFile,
    kTemplate,
    kStandalone,
    kSelfContained,
  ];
  const defaults: FormatPandoc = {};
  kOrder.forEach((key) => {
    if (Object.keys(pandoc).includes(key)) {
      // deno-lint-ignore no-explicit-any
      (defaults as any)[key] = (pandoc as any)[key];
    }
  });
  Object.keys(pandoc).forEach((key) => {
    if (!kOrder.includes(key) && (debug || !kDebugOnly.includes(key))) {
      // deno-lint-ignore no-explicit-any
      (defaults as any)[key] = (pandoc as any)[key];
    }
  });
  return stringify(defaults as Record<string, unknown>);
}
