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

import { basename, dirname, extname } from "path/mod.ts";
import { stringify } from "encoding/yaml.ts";

import { execProcess, ProcessResult } from "../../core/process.ts";
import { message } from "../../core/console.ts";

import { Format, FormatPandoc, isHtmlFormat } from "../../config/format.ts";
import { pdfEngine } from "../../config/pdf.ts";
import { Metadata } from "../../config/metadata.ts";

import {
  kBibliography,
  kFilters,
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

import { kPatchedTemplateExt } from "./output.ts";
import { RenderFlags } from "./flags.ts";
import { mergeConfigs } from "../../core/config.ts";
import { resourcePath } from "../../core/resources.ts";
import { readYamlFromString } from "../../core/yaml.ts";

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
  let allDefaults: FormatPandoc | undefined;
  const detectedDefaults = await detectDefaults(
    options.input,
    options.format.pandoc,
  );
  if (detectedDefaults || options.format.pandoc) {
    allDefaults = mergeConfigs(
      detectedDefaults || {},
      options.format.pandoc || {},
    );
    // resolve filters
    const filters = resolveFilters(allDefaults[kFilters], options);
    if (filters) {
      allDefaults[kFilters] = filters;
    }

    const defaults = "---\n" +
      stringify(allDefaults as Record<string, unknown>);
    const defaultsFile = await Deno.makeTempFile(
      { prefix: "quarto-defaults", suffix: ".yml" },
    );
    await Deno.writeTextFile(defaultsFile, defaults);
    cmd.push("--defaults", defaultsFile);
  }

  // build command line args
  const args = [...options.args];

  // provide default title based on filename if necessdary
  if (!options.format.metadata["title"]) {
    args.push(
      "--metadata",
      "title:" + options.input.slice(0, options.input.indexOf(".")),
    );
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
      args,
      allDefaults,
      options.format.metadata,
    );
  }

  // apply workaround for .output suppression
  // https://github.com/jgm/pandoc/issues/6841#issuecomment-728281039
  cmd.push("--ipynb-output=all");

  // run pandoc
  return await execProcess(
    {
      cmd,
      cwd: dirname(options.input),
    },
    input,
  );
}

async function detectDefaults(
  file: string,
  format: FormatPandoc,
): Promise<FormatPandoc | undefined> {
  if (isHtmlFormat(format)) {
    const cmd = [
      "pandoc",
      file,
      "--to",
      resourcePath("lua/html-defaults.lua"),
    ];
    const result = await execProcess({ cmd, stdout: "piped" });
    if (result.success) {
      const defaults = (result.stdout || "").trim();
      if (defaults) {
        return readYamlFromString(`---\n${defaults}\n`) as FormatPandoc;
      } else {
        return undefined;
      }
    } else {
      throw new Error();
    }
  } else {
    return undefined;
  }
}

type CiteMethod = "citeproc" | "natbib" | "biblatex";

function citeMethod(options: PandocOptions): CiteMethod | null {
  // no handler if no references
  const pandoc = options.format.pandoc;
  const metadata = options.format.metadata;
  if (!metadata[kBibliography] && !metadata.references) {
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

function resolveFilters(filters: string[] | undefined, options: PandocOptions) {
  filters = filters || [];

  // add citeproc filter if necessary
  const citeproc = citeMethod(options) === "citeproc";
  if (citeproc && !filters.includes("citeproc")) {
    filters.unshift("citeproc");
  }

  // add crossref filter if necessary (unshift will put it before citeproc)
  if (options.format.metadata["crossref"] !== false) {
    filters.unshift(crossrefFilter());
  }

  if (filters.length > 0) {
    return filters;
  } else {
    return undefined;
  }
}

function runPandocMessage(
  args: string[],
  pandoc: FormatPandoc | undefined,
  metadata: Metadata,
  debug?: boolean,
) {
  message(`pandoc ${args.join(" ")}`, { bold: true });
  if (pandoc) {
    message(pandocDefaultsMessage(pandoc, debug), { indent: 2 });
  }

  if (Object.keys(metadata).length > 0) {
    message("metadata", { bold: true });
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

  // simplify crossref filter
  if (defaults.filters?.length) {
    defaults.filters = defaults.filters.map((filter) => {
      if (filter === crossrefFilter()) {
        return "crossref";
      } else {
        return filter;
      }
    });
  }

  // remove template if it's patched
  if (defaults.template && extname(defaults.template) === kPatchedTemplateExt) {
    delete defaults.template;
  }

  return stringify(defaults as Record<string, unknown>);
}

function crossrefFilter() {
  return resourcePath("lua/crossref/crossref.lua");
}
