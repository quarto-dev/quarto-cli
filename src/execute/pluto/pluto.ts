/*
 * pluto.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { extname } from "path/mod.ts";

import { partitionMarkdown } from "../../core/pandoc/pandoc-partition.ts";

import { Format } from "../../config/types.ts";

import { RenderOptions } from "../../command/render/types.ts";
import {
  DependenciesOptions,
  ExecuteOptions,
  ExecuteResult,
  ExecutionEngine,
  ExecutionTarget,
  kPlutoEngine,
  kQmdExtensions,
  PandocIncludes,
  PostProcessOptions,
} from "../types.ts";

import { MappedString, mappedStringFromFile } from "../../core/mapped-text.ts";
import { ProjectContext } from "../../project/types.ts";
import { readYamlFromMarkdown } from "../../core/yaml.ts";

const kPlutoExtensions = [".jl"];

// TODO: more robust detection
function isPlutoNotebook(file: string) {
  return kPlutoExtensions.includes(extname(file).toLowerCase());
}

export const plutoEngine: ExecutionEngine = {
  name: kPlutoEngine,

  defaultExt: ".qmd",

  defaultYaml: () => [
    `engine: pluto`,
  ],

  defaultContent: () => {
    return [
      "```{julia}",
      "1 + 1",
      "```",
    ];
  },

  validExtensions: () => kQmdExtensions.concat(...kPlutoExtensions),

  claimsExtension: (ext: string) => {
    return kPlutoExtensions.includes(ext.toLowerCase());
  },

  claimsLanguage: (_language: string) => {
    return false;
  },

  target: async (
    file: string,
    _quiet?: boolean,
    markdown?: MappedString,
    _project?: ProjectContext,
  ): Promise<ExecutionTarget | undefined> => {
    if (markdown === undefined) {
      markdown = mappedStringFromFile(file);
    }
    const target: ExecutionTarget = {
      source: file,
      input: file,
      markdown,
      metadata: readYamlFromMarkdown(markdown.value),
    };
    return Promise.resolve(target);
  },

  partitionedMarkdown: async (file: string, _format?: Format) => {
    //
    if (isPlutoNotebook(file)) {
      // TODO: partitioned markdown from .jl file e.g.
      // return partitionMarkdown(await markdownFromNotebookFile(file, format));
      return partitionMarkdown(Deno.readTextFileSync(file));
    } else {
      return partitionMarkdown(Deno.readTextFileSync(file));
    }
  },

  filterFormat: (
    _source: string,
    _options: RenderOptions,
    format: Format,
  ) => {
    // TODO ?

    return format;
  },

  execute: async (options: ExecuteOptions): Promise<ExecuteResult> => {
    // TODO: execute

    // TODO: consider creating an ipypnb and then calling the
    // jupyterToMarkdown function to get quarto compliant markdown generation for free

    const markdown = "# Pluto Engine\n" + options.target.markdown.value;
    return Promise.resolve({
      markdown,
      supporting: [],
      filters: [],
    });
  },

  // TODO: ask dragonstyle what to do here
  executeTargetSkipped: () => false,

  // TODO: just return dependencies from execute and this can do nothing
  dependencies: (_options: DependenciesOptions) => {
    const includes: PandocIncludes = {};
    return Promise.resolve({
      includes,
    });
  },

  // TODO: this can also probably do nothing
  postprocess: (_options: PostProcessOptions) => {
    return Promise.resolve();
  },

  canFreeze: true,

  generatesFigures: true,

  ignoreDirs: () => {
    return [];
  },

  canKeepSource: (_target: ExecutionTarget) => {
    return true;
  },

  // TODO: contact us to talk about the right way to handle
  keepFiles: (input: string) => {
    const files: string[] = [];
    return files;
  },
};
