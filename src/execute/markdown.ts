/*
* markdown.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { readYamlFromMarkdownFile } from "../core/yaml.ts";
import { partitionMarkdown } from "../core/pandoc/pandoc-partition.ts";

import { Metadata } from "../config/metadata.ts";

import {
  DependenciesOptions,
  ExecuteOptions,
  ExecutionEngine,
  kQmdExtensions,
  PostProcessOptions,
} from "./engine.ts";

export const markdownEngine: ExecutionEngine = {
  name: "none",

  defaultExt: ".md",

  defaultYaml: () => [],

  validExtensions: () => kQmdExtensions,

  claimsExtension: (_ext: string) => {
    return false;
  },
  claimsLanguage: (_language: string) => {
    return false;
  },

  target: (file: string) => {
    return Promise.resolve({ source: file, input: file });
  },

  metadata: (file: string) =>
    Promise.resolve(readYamlFromMarkdownFile(file) as Metadata),

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

  canKeepMd: false,

  renderOnChange: true,
};
