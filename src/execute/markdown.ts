import { existsSync } from "fs/exists.ts";

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

export function markdownEngine(): ExecutionEngine {
  return {
    name: "markdown",
    handle: (file: string) => Promise.resolve({ source: file, input: file }),
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
}
