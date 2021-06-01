/*
* observable.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Metadata } from "../../config/metadata.ts";
import { partitionMarkdown } from "../../core/pandoc/pandoc-partition.ts";
import { readYamlFromMarkdownFile } from "../../core/yaml.ts";
import {
  DependenciesOptions,
  ExecuteOptions,
  ExecutionEngine,
  kQmdExtensions,
  PostProcessOptions,
} from "../engine.ts";

export const observableEngine: ExecutionEngine = {
  name: "observable",

  defaultExt: ".qmd",

  defaultYaml: () => [],

  validExtensions: () => kQmdExtensions,

  claimsExtension: (_ext: string) => {
    return false;
  },
  claimsLanguage: (language: string) => {
    return language === "ojs";
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

    // TODO
    // equivalent of quartoMdToJupyter, then off to the races!!!!
    // Errors in execution need to still render a page with the error

    return Promise.resolve({
      markdown: markdown + "\n\nBrought to you by Observable",

      // for raw html,
      // ```{=html}
      //
      // ```

      dependencies: {
        type: "includes",
        data: {
          // files or not files, who knows!
        },
      },
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

  canKeepMd: true,

  renderOnChange: true,
};
