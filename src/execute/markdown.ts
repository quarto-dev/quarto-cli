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
  name: "markdown",

  canHandle: (file: string) => {
    return kMarkdownExtensions.includes(extname(file).toLowerCase());
  },

  target: async (file: string) => {
    return { source: file, input: file };
  },

  metadata: (context: ExecutionTarget) =>
    Promise.resolve(readYamlFromMarkdownFile(context.input) as Metadata),
  execute: async (options: ExecuteOptions) => {
    // read markdown
    const markdown = Deno.readTextFileSync(options.target.input);

    return Promise.resolve({
      markdown,
      supporting: [],
      filters: [],
      pandoc: {} as FormatPandoc,
    });
  },
  dependencies: async (_options: DependenciesOptions) => {
    return {
      pandoc: {},
    };
  },
  postprocess: (_options: PostProcessOptions) => Promise.resolve(),
  keepMd: (_input: string) => undefined,
};
