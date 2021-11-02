/*
* markdown.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { readYamlFromMarkdownFile } from "../core/yaml.ts";
import { partitionMarkdown } from "../core/pandoc/pandoc-partition.ts";

import { Metadata } from "../config/types.ts";

import {
  DependenciesOptions,
  ExecuteOptions,
  ExecutionEngine,
  kMarkdownEngine,
  kQmdExtensions,
  PostProcessOptions,
} from "./types.ts";

export const kMdExtensions = [".md", ".markdown"];

export const markdownEngine: ExecutionEngine = {
  name: kMarkdownEngine,

  defaultExt: ".qmd",

  defaultYaml: () => [],

  defaultContent: () => [],

  validExtensions: () => kQmdExtensions.concat(kMdExtensions),

  claimsExtension: (ext: string) => {
    return kMdExtensions.includes(ext.toLowerCase());
  },
  claimsLanguage: (_language: string) => {
    return false;
  },

  target: (file: string) => {
    return Promise.resolve({
      source: file,
      input: file,
      metadata: readYamlFromMarkdownFile(file) as Metadata,
    });
  },

  partitionedMarkdown: (file: string) => {
    return Promise.resolve(partitionMarkdown(Deno.readTextFileSync(file)));
  },

  execute: (options: ExecuteOptions) => {
    // read markdown
    const markdown = Deno.readTextFileSync(options.target.input);

    return Promise.resolve({
      markdown,
      supporting: [],
      filters: [],
    });
  },
  dependencies: (_options: DependenciesOptions) => {
    return Promise.resolve({
      includes: {},
    });
  },
  postprocess: (_options: PostProcessOptions) => Promise.resolve(),

  canFreeze: false,
};
