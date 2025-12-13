/*
 * engine-project-context.ts
 *
 * Copyright (C) 2023 Posit Software, PBC
 */

import { MappedString } from "../core/mapped-text.ts";
import { ExecutionEngineInstance } from "../execute/types.ts";
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
  const project: EngineProjectContext = {
    // Core properties
    dir: context.dir,
    isSingleFile: context.isSingleFile,
    config: context.config
      ? {
        engines: context.config.engines as string[] | undefined,
        project: context.config.project
          ? {
            "output-dir": context.config.project["output-dir"],
          }
          : undefined,
      }
      : undefined,
    fileInformationCache: context.fileInformationCache,

    // Path utilities
    getOutputDirectory: () => {
      return projectOutputDir(context);
    },

    // Core methods
    resolveFullMarkdownForFile: (
      engine: ExecutionEngineInstance | undefined,
      file: string,
      markdown?: MappedString,
      force?: boolean,
    ) => context.resolveFullMarkdownForFile(engine, file, markdown, force),
  };

  return project;
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
    typeof ctx.resolveFullMarkdownForFile === "function"
  );
}
