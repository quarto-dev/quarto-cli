/*
* markdown.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { extname } from "path/mod.ts";

import { readYamlFromMarkdownFile } from "../core/yaml.ts";

import { FormatPandoc } from "../config/format.ts";
import { Metadata } from "../config/metadata.ts";

import {
  DependenciesOptions,
  ExecuteOptions,
  ExecutionEngine,
  ExecutionTarget,
  PostProcessOptions,
} from "./engine.ts";

const kMarkdownExtensions = [".md", ".markdown"];

export const markdownEngine: ExecutionEngine = {
  name: "none",

  defaultExt: ".md",

  defaultYaml: () => [],

  canHandle: (file: string) => {
    return kMarkdownExtensions.includes(extname(file).toLowerCase());
  },

  target: (file: string) => {
    return Promise.resolve({ source: file, input: file });
  },

  metadata: (file: string) =>
    Promise.resolve(readYamlFromMarkdownFile(file) as Metadata),
  execute: (options: ExecuteOptions) => {
    // read markdown
    const markdown = Deno.readTextFileSync(options.target.input);

    return Promise.resolve({
      markdown,
      supporting: [],
      filters: [],
      pandoc: {} as FormatPandoc,
    });
  },
  dependencies: (_options: DependenciesOptions) => {
    return Promise.resolve({
      pandoc: {},
    });
  },
  postprocess: (_options: PostProcessOptions) => Promise.resolve(),
  keepMd: (_input: string) => undefined,
  keepFiles: (__input: string) => undefined,
};
