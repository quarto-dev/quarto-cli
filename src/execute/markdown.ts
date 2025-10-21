/*
 * markdown.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { extname } from "../deno_ral/path.ts";

import {
  DependenciesOptions,
  ExecuteOptions,
  ExecutionEngineDiscovery,
  ExecutionTarget,
  LaunchedExecutionEngine,
  kMarkdownEngine,
  kQmdExtensions,
  PostProcessOptions,
} from "./types.ts";
import { MappedString } from "../core/lib/text-types.ts";
import { EngineProjectContext } from "../project/types.ts";

export const kMdExtensions = [".md", ".markdown"];

/**
 * Markdown engine implementation with discovery and launch capabilities
 */
export const markdownEngineDiscovery: ExecutionEngineDiscovery = {
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
  canFreeze: false,
  generatesFigures: false,

  /**
   * Launch a dynamic execution engine with project context
   */
  launch: (context: EngineProjectContext): LaunchedExecutionEngine => {
    return {
      markdownForFile(file: string): Promise<MappedString> {
        return Promise.resolve(context.mappedStringFromFile(file));
      },

      target: (file: string, _quiet?: boolean, markdown?: MappedString) => {
        if (markdown === undefined) {
          markdown = context.mappedStringFromFile(file);
        }
        const target: ExecutionTarget = {
          source: file,
          input: file,
          markdown,
          metadata: context.readYamlFromMarkdown(markdown.value),
        };
        return Promise.resolve(target);
      },

      partitionedMarkdown: (file: string) => {
        return Promise.resolve(
          context.partitionMarkdown(Deno.readTextFileSync(file)),
        );
      },

      execute: (options: ExecuteOptions) => {
        // read markdown
        const markdown = options.target.markdown.value;

        // if it's plain md, validate that it doesn't have executable cells in it
        if (extname(options.target.input).toLowerCase() === ".md") {
          const languages = context.languagesInMarkdown(markdown);
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
    };
  }
};
