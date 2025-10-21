/*
 * engine-project-context.ts
 *
 * Copyright (C) 2023 Posit Software, PBC
 */

import { Metadata } from "../config/types.ts";
import {
  asMappedString,
  mappedNormalizeNewlines,
  MappedString,
  mappedStringFromFile,
} from "../core/mapped-text.ts";
import { PartitionedMarkdown } from "../core/pandoc/types.ts";
import { partitionMarkdown } from "../core/pandoc/pandoc-partition.ts";
import { readYamlFromMarkdown } from "../core/yaml.ts";
import { ExecutionEngine } from "../execute/types.ts";
import { languagesInMarkdown } from "../execute/engine-shared.ts";
import { projectOutputDir } from "./project-shared.ts";
import {
  EngineProjectContext,
  FileInformation,
  ProjectContext,
} from "./types.ts";

/**
 * Creates an EngineProjectContext adapter from a ProjectContext
 * This provides a restricted view of ProjectContext with additional utility methods
 *
 * @param context The source ProjectContext
 * @returns An EngineProjectContext adapter
 */
export function engineProjectContext(
  context: ProjectContext,
): EngineProjectContext {
  return {
    // Core properties
    dir: context.dir,
    isSingleFile: context.isSingleFile,
    config: context.config
      ? {
        engines: context.config.engines,
        project: context.config.project
          ? {
            "output-dir": context.config.project["output-dir"],
          }
          : undefined,
      }
      : undefined,
    fileInformationCache: context.fileInformationCache,

    // Hidden property for adapter access to full ProjectContext
    _project: context,

    // Path utilities
    getOutputDirectory: () => {
      return projectOutputDir(context);
    },

    // Core methods
    resolveFullMarkdownForFile: (
      engine: ExecutionEngine | undefined,
      file: string,
      markdown?: MappedString,
      force?: boolean,
    ) => context.resolveFullMarkdownForFile(engine, file, markdown, force),

    // YAML utilities
    readYamlFromMarkdown: (markdown: string) => {
      return readYamlFromMarkdown(markdown);
    },

    // Markdown utilities
    partitionMarkdown: (markdown: string) => {
      return partitionMarkdown(markdown);
    },

    languagesInMarkdown: (markdown: string) => {
      return languagesInMarkdown(markdown);
    },

    normalizeMarkdown: (markdown: MappedString) => {
      return mappedNormalizeNewlines(markdown);
    },

    // Mapped string utilities
    mappedStringFromString: (text: string, fileName?: string) => {
      return asMappedString(text, fileName);
    },

    mappedStringFromFile: (path: string) => {
      return mappedStringFromFile(path);
    },
  };
}

/**
 * Type guard to check if an object implements the EngineProjectContext interface
 *
 * @param obj Object to check
 * @returns Whether the object is an EngineProjectContext
 */
export function isEngineProjectContext(
  obj: unknown,
): obj is EngineProjectContext {
  if (!obj) return false;

  const ctx = obj as Partial<EngineProjectContext>;
  return (
    typeof ctx.dir === "string" &&
    typeof ctx.isSingleFile === "boolean" &&
    typeof ctx.resolveFullMarkdownForFile === "function" &&
    typeof ctx.readYamlFromMarkdown === "function" &&
    typeof ctx.partitionMarkdown === "function"
  );
}
