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
import type { QuartoAPI } from "../core/api/index.ts";

export const kMdExtensions = [".md", ".markdown"];

let quarto: QuartoAPI;

/**
 * Markdown engine implementation with discovery and launch capabilities
 */
export const markdownEngineDiscovery: ExecutionEngineDiscovery = {
  init: (quartoAPI) => {
    quarto = quartoAPI;
  },

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
  launch: (context: EngineProjectContext): ExecutionEngineInstance => {
    return {
      name: markdownEngineDiscovery.name,
      canFreeze: markdownEngineDiscovery.canFreeze,

      markdownForFile(file: string): Promise<MappedString> {
        return Promise.resolve(quarto.mappedString.fromFile(file));
      },

      target: (file: string, _quiet?: boolean, markdown?: MappedString) => {
        const md = markdown ?? quarto.mappedString.fromFile(file);
        const target: ExecutionTarget = {
          source: file,
          input: file,
          markdown: md,
          metadata: quarto.markdownRegex.extractYaml(md.value),
        };
        return Promise.resolve(target);
      },

      partitionedMarkdown: (file: string) => {
        return Promise.resolve(
          quarto.markdownRegex.partition(Deno.readTextFileSync(file)),
        );
      },

      execute: (options: ExecuteOptions) => {
        // read markdown
        const markdown = options.target.markdown.value;

        // if it's plain md, validate that it doesn't have executable cells in it
        if (extname(options.target.input).toLowerCase() === ".md") {
          const languages = quarto.markdownRegex.getLanguages(markdown);
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
