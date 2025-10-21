/*
 * markdown.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { extname } from "../deno_ral/path.ts";

import {
  DependenciesOptions,
  ExecuteOptions,
  ExecutionEngine,
  ExecutionTarget,
  kMarkdownEngine,
  kQmdExtensions,
  PostProcessOptions,
} from "./types.ts";
import { MappedString } from "../core/lib/text-types.ts";
import { EngineProjectContext } from "../project/types.ts";

export const kMdExtensions = [".md", ".markdown"];

export const markdownEngine = (
  engineProjectContext: EngineProjectContext,
): ExecutionEngine => ({
  name: kMarkdownEngine,

  defaultExt: ".qmd",

  defaultYaml: () => [],

  defaultContent: () => [],

  validExtensions: () => kQmdExtensions.concat(kMdExtensions),

  claimsFile: (_file: string, ext: string) => {
    return kMdExtensions.includes(ext.toLowerCase());
  },
  claimsLanguage: (_language: string) => {
    return false;
  },
  markdownForFile(file: string): Promise<MappedString> {
    return Promise.resolve(engineProjectContext.mappedStringFromFile(file));
  },

  target: (file: string, _quiet?: boolean, markdown?: MappedString) => {
    if (markdown === undefined) {
      markdown = engineProjectContext.mappedStringFromFile(file);
    }
    const target: ExecutionTarget = {
      source: file,
      input: file,
      markdown,
      metadata: engineProjectContext.readYamlFromMarkdown(markdown.value),
    };
    return Promise.resolve(target);
  },

  partitionedMarkdown: (file: string) => {
    return Promise.resolve(
      engineProjectContext.partitionMarkdown(Deno.readTextFileSync(file)),
    );
  },

  execute: (options: ExecuteOptions) => {
    // read markdown
    const markdown = options.target.markdown.value;

    // if it's plain md, validate that it doesn't have executable cells in it
    if (extname(options.target.input).toLowerCase() === ".md") {
      const languages = engineProjectContext.languagesInMarkdown(markdown);
      if (languages.size > 0) {
        throw new Error(
          "You must use the .qmd extension for documents with executable code.",
        );
      }
    }

    return Promise.resolve({
      engine: kMarkdownEngine,
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
});
