/*
 * as-engine-instance.ts
 *
 * Copyright (C) 2023 Posit Software, PBC
 */

import {
  DependenciesOptions,
  DependenciesResult,
  ExecuteOptions,
  ExecuteResult,
  ExecutionEngine,
  ExecutionEngineDiscovery,
  ExecutionEngineInstance,
  ExecutionTarget,
  PostProcessOptions,
  RunOptions,
} from "./types.ts";
import { RenderResultFile } from "../command/render/types.ts";
import { EngineProjectContext } from "../project/types.ts";
import { Format } from "../config/types.ts";
import { MappedString } from "../core/lib/text-types.ts";
import { PartitionedMarkdown } from "../core/pandoc/types.ts";
import { RenderOptions } from "../command/render/types.ts";
import { ProjectContext } from "../project/types.ts";

/**
 * Creates an ExecutionEngineInstance adapter for legacy ExecutionEngine implementations
 *
 * @param engine The legacy ExecutionEngine to adapt
 * @param context The EngineProjectContext to use
 * @returns An ExecutionEngineInstance that delegates to the legacy engine
 */
export function asEngineInstance(
  engine: ExecutionEngine,
  context: EngineProjectContext,
): ExecutionEngineInstance {
  // Check if the engine is actually a discovery engine with the _discovery flag
  if ((engine as any)._discovery === true) {
    // Cast to ExecutionEngineDiscovery and call launch()
    return (engine as unknown as ExecutionEngineDiscovery).launch(context);
  }

  // Access the hidden _project property via type cast
  const project = (context as any)._project as ProjectContext;

  if (!project) {
    throw new Error("Invalid EngineProjectContext: missing _project property");
  }

  return {
    name: engine.name,
    canFreeze: engine.canFreeze,

    /**
     * Read file and convert to markdown with source mapping
     */
    markdownForFile(file: string): Promise<MappedString> {
      return engine.markdownForFile(file);
    },

    /**
     * Create an execution target for a file
     */
    target(
      file: string,
      quiet?: boolean,
      markdown?: MappedString,
    ): Promise<ExecutionTarget | undefined> {
      return engine.target(file, quiet, markdown, project);
    },

    /**
     * Extract partitioned markdown from a file
     */
    partitionedMarkdown(
      file: string,
      format?: Format,
    ): Promise<PartitionedMarkdown> {
      return engine.partitionedMarkdown(file, format);
    },

    /**
     * Modify format configuration based on engine requirements
     */
    filterFormat: engine.filterFormat,

    /**
     * Execute a document
     */
    execute(options: ExecuteOptions): Promise<ExecuteResult> {
      // We need to ensure the project is correctly set
      return engine.execute({
        ...options,
        project: project,
      });
    },

    /**
     * Handle skipped execution
     */
    executeTargetSkipped: engine.executeTargetSkipped
      ? (target: ExecutionTarget, format: Format): void => {
        engine.executeTargetSkipped!(target, format, project);
      }
      : undefined,

    /**
     * Process dependencies
     */
    dependencies(options: DependenciesOptions): Promise<DependenciesResult> {
      return engine.dependencies(options);
    },

    /**
     * Post-process output
     */
    postprocess(options: PostProcessOptions): Promise<void> {
      return engine.postprocess(options);
    },

    /**
     * Check if source can be kept
     */
    canKeepSource: engine.canKeepSource,

    /**
     * Get intermediate files
     */
    intermediateFiles: engine.intermediateFiles,

    /**
     * Run server mode if supported
     */
    run: engine.run
      ? (options: RunOptions): Promise<void> => {
        return engine.run!(options);
      }
      : undefined,

    /**
     * Post-render processing
     */
    postRender: engine.postRender
      ? (file: RenderResultFile): Promise<void> => {
        return engine.postRender!(file, project);
      }
      : undefined,
  };
}
