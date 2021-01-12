/*
* defaults.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { extname } from "path/mod.ts";
import { stringify } from "encoding/yaml.ts";

import { execProcess } from "../../core/process.ts";
import { mergeConfigs } from "../../core/config.ts";
import { binaryPath, resourcePath } from "../../core/resources.ts";
import { readYamlFromString } from "../../core/yaml.ts";

import { FormatPandoc, isHtmlFormat } from "../../config/format.ts";

import {
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
import { PandocOptions } from "./pandoc.ts";
import { crossrefFilter, crossrefGeneratedDefaults } from "./crossref.ts";
import { layoutFilter } from "./layout.ts";
import {
  quartoPostFilter,
  quartoPreFilter,
  resolveFilters,
} from "./filters.ts";
import { sessionTempFile } from "../../core/temp.ts";

export async function generateDefaults(
  options: PandocOptions,
  sysFilters: string[],
): Promise<FormatPandoc | undefined> {
  let allDefaults: FormatPandoc | undefined;

  const detectedDefaults = await detectDefaults(
    options.input,
    options.format.pandoc,
  );

  const crossrefDefaults = crossrefGeneratedDefaults(options);

  if (detectedDefaults || crossrefDefaults || options.format.pandoc) {
    allDefaults = mergeConfigs(
      detectedDefaults || {},
      crossrefDefaults || {},
      options.format.pandoc || {},
    );
    // resolve filters
    const resolvedFilters = resolveFilters([
      ...sysFilters,
      ...(allDefaults[kFilters] || []),
    ], options);
    if (resolvedFilters) {
      allDefaults[kFilters] = resolvedFilters;
    }

    return allDefaults;
  } else {
    return undefined;
  }
}

export async function writeDefaultsFile(defaults: FormatPandoc) {
  const defaultsStr = "---\n" + stringify(defaults as Record<string, unknown>);
  const defaultsFile = sessionTempFile(
    { prefix: "quarto-defaults", suffix: ".yml" },
  );
  await Deno.writeTextFile(defaultsFile, defaultsStr);
  return defaultsFile;
}

export function pandocDefaultsMessage(
  pandoc: FormatPandoc,
  sysFilters: string[],
  debug?: boolean,
) {
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
    defaults.filters = defaults.filters
      .map((filter) => {
        if (filter === crossrefFilter()) {
          return "crossref";
        } else {
          return filter;
        }
      })
      .filter((filter) => {
        return filter !== quartoPreFilter() &&
          filter !== quartoPostFilter() &&
          filter !== layoutFilter() &&
          !sysFilters.includes(filter);
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
      binaryPath("pandoc"),
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
