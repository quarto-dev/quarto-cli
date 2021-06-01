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
import { lines } from "../../core/text.ts";

import { includesForObservableDependencies } from "../../core/observable/includes.ts";

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
    const dependencies = includesForObservableDependencies();
    
    // TODO
    // equivalent of quartoMdToJupyter, then off to the races!!!!
    // Errors in execution need to still render a page with the error

    // Stupid attempt #1:
    //   (may they be merciful on my soul)
    let ls = lines(markdown);
    for (let i = 0; i < ls.length; ++i) {
      let l = ls[i];
      if (l === "```{ojs}") {
        ls[i] = "```{=html}\n<script type=\"observable-js\">";
        for (let j = i + 1; j < ls.length; ++j) {
          let maybeCloseTicks = ls[j];
          if (ls[j] === "```") {
            ls[j] = "</script>\n```";
          }
        }
      }
    }
    
    return Promise.resolve({
      markdown: ls.join("\n") + "\n\n**Now with observable-js script tags**",

      // for raw html,
      // ```{=html}
      //
      // ```

      dependencies: {
        ...dependencies,
        type: "includes"
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
