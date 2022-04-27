/*
* markdown.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { extname } from "path/mod.ts";

import { readYamlFromMarkdown } from "../core/yaml.ts";
import { partitionMarkdown } from "../core/pandoc/pandoc-partition.ts";

import {
  DependenciesOptions,
  ExecuteOptions,
  ExecutionEngine,
  ExecutionTarget,
  kMarkdownEngine,
  kQmdExtensions,
  PostProcessOptions,
} from "./types.ts";
import { languagesInMarkdown } from "./engine-shared.ts";
import { mappedStringFromFile } from "../core/mapped-text.ts";

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
    const markdown = mappedStringFromFile(file);
    const target: ExecutionTarget = {
      source: file,
      input: file,
      markdown,
      metadata: readYamlFromMarkdown(markdown.value),
    };
    return Promise.resolve(target);
  },

  partitionedMarkdown: (file: string) => {
    return Promise.resolve(partitionMarkdown(Deno.readTextFileSync(file)));
  },

  execute: (options: ExecuteOptions) => {
    // read markdown
    const markdown = options.target.markdown.value;

    // if it's plain md, validate that it doesn't have executable cells in it
    if (extname(options.target.input).toLowerCase() === ".md") {
      const languages = languagesInMarkdown(markdown);
      if (languages.size > 0) {
        throw new Error(
          "You must use the .qmd extension for documents with executable code.",
        );
      }
    }

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
  generatesFigures: false,
};
