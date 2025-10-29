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
  ExecutionEngineInstance,
  ExecutionTarget,
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
  claimsFile: (_quarto, _file: string, ext: string) => {
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
  launch: (context: EngineProjectContext): ExecutionEngineInstance => {
    return {
      name: markdownEngineDiscovery.name,
      canFreeze: markdownEngineDiscovery.canFreeze,

      markdownForFile(file: string): Promise<MappedString> {
        return Promise.resolve(context.quarto.mappedString.fromFile(file));
      },

      target: (file: string, _quiet?: boolean, markdown?: MappedString) => {
        if (markdown === undefined) {
          markdown = context.quarto.mappedString.fromFile(file);
        }
        const target: ExecutionTarget = {
          source: file,
          input: file,
          markdown,
          metadata: context.quarto.markdownRegex.extractYaml(markdown.value),
        };
        return Promise.resolve(target);
      },

      partitionedMarkdown: (file: string) => {
        return Promise.resolve(
          context.quarto.markdownRegex.partition(Deno.readTextFileSync(file)),
        );
      },

      execute: (options: ExecuteOptions) => {
        // read markdown
        const markdown = options.target.markdown.value;

        // if it's plain md, validate that it doesn't have executable cells in it
        if (extname(options.target.input).toLowerCase() === ".md") {
          const languages = context.quarto.markdownRegex.getLanguages(markdown);
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
  },
};
