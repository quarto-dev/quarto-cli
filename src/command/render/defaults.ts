/*
* defaults.ts
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
import { stringify } from "encoding/yaml.ts";

import { execProcess } from "../../core/process.ts";

import { FormatPandoc, isHtmlFormat } from "../../config/format.ts";
import { pdfEngine } from "../../config/pdf.ts";

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
import { mergeConfigs } from "../../core/config.ts";
import { resourcePath } from "../../core/resources.ts";
import { readYamlFromString } from "../../core/yaml.ts";
import { crossrefFilterActive, PandocOptions } from "./pandoc.ts";

export async function generateDefaults(
  options: PandocOptions,
): Promise<FormatPandoc | undefined> {
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

    return allDefaults;
  } else {
    return undefined;
  }
}

export async function writeDefaultsFile(defaults: FormatPandoc) {
  const defaultsStr = "---\n" + stringify(defaults as Record<string, unknown>);
  const defaultsFile = await Deno.makeTempFile(
    { prefix: "quarto-defaults", suffix: ".yml" },
  );
  await Deno.writeTextFile(defaultsFile, defaultsStr);
  return defaultsFile;
}

export function pandocDefaultsMessage(pandoc: FormatPandoc, debug?: boolean) {
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

async function detectDefaults(
  file: string,
  format: FormatPandoc,
): Promise<FormatPandoc | undefined> {
  if (isHtmlFormat(format)) {
    const cmd = [
      "pandoc",
      file,
      "--from",
      format.from || "markdown",
      "--to",
      resourcePath("html-defaults.lua"),
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
  if (crossrefFilterActive(options.format)) {
    filters.unshift(crossrefFilter());
  }

  if (filters.length > 0) {
    return filters;
  } else {
    return undefined;
  }
}

function crossrefFilter() {
  return resourcePath("filters/src/crossref/crossref.lua");
}
