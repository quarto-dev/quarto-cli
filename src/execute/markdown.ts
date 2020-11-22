import { existsSync } from "fs/exists.ts";

import { readYamlFromMarkdownFile } from "../core/yaml.ts";

import { FormatPandoc } from "../config/format.ts";
import { Metadata } from "../config/metadata.ts";

import {
  ExecuteOptions,
  ExecutionEngine,
  ExecutionTarget,
  PostProcessOptions,
} from "./engine.ts";

export function markdownEngine(): ExecutionEngine {
  return {
    name: "markdown",
    handle: (file: string) => Promise.resolve({ input: file }),
    metadata: (context: ExecutionTarget) =>
      Promise.resolve(readYamlFromMarkdownFile(context.input) as Metadata),
    execute: async (options: ExecuteOptions) => {
      // copy input to output (unless they are the same path)
      if (
        !existsSync(options.output) ||
        (Deno.realPathSync(options.target.input) !==
          Deno.realPathSync(options.output))
      ) {
        await Deno.copyFile(options.target.input, options.output);
      }

      return Promise.resolve({
        supporting: [],
        pandoc: {} as FormatPandoc,
      });
    },
    postprocess: (_options: PostProcessOptions) => Promise.resolve(),
    keepMd: (_input: string) => undefined,
  };
}
