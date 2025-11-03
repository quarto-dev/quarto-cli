/**
 * Execution engine interfaces for Quarto
 */

import type { MappedString } from "./text.ts";
import type { Format } from "./format.ts";
import type { Metadata } from "./metadata.ts";
import type { EngineProjectContext } from "./project-context.ts";
import type { Command } from "./cli.ts";
import type { QuartoAPI } from "./quarto-api.ts";
import type {
  ExecuteOptions,
  ExecuteResult,
  DependenciesOptions,
  DependenciesResult,
  PostProcessOptions,
  RunOptions,
} from "./execution.ts";
import type {
  RenderFlags,
  RenderOptions,
  RenderResultFile,
} from "./render.ts";
import type { PartitionedMarkdown } from "./markdown.ts";
import type { PandocIncludes, PandocIncludeLocation } from "./pandoc.ts";
import type { CheckConfiguration } from "./check.ts";

/**
 * Execution target (filename and context)
 */
export interface ExecutionTarget {
  /** Original source file */
  source: string;

  /** Input file after preprocessing */
  input: string;

  /** Markdown content */
  markdown: MappedString;

  /** Document metadata */
  metadata: Metadata;

  /** Optional target-specific data */
  data?: unknown;
}

/**
 * Interface for execution engine discovery
 * Responsible for the static aspects of engine discovery (not requiring project context)
 */
export interface ExecutionEngineDiscovery {
  /**
   * Initialize the engine with the Quarto API (optional)
   * May be called multiple times but always with the same QuartoAPI object.
   * Engines should store the reference to use throughout their lifecycle.
   *
   * @param quarto - The Quarto API for accessing utilities
   */
  init?: (quarto: QuartoAPI) => void;

  /**
   * Name of the engine
   */
  name: string;

  /**
   * Default extension for files using this engine
   */
  defaultExt: string;

  /**
   * Generate default YAML for this engine
   */
  defaultYaml: (kernel?: string) => string[];

  /**
   * Generate default content for this engine
   */
  defaultContent: (kernel?: string) => string[];

  /**
   * List of file extensions this engine supports
   */
  validExtensions: () => string[];

  /**
   * Whether this engine can handle the given file
   *
   * @param file - The file path to check
   * @param ext - The file extension
   * @returns True if this engine can handle the file
   */
  claimsFile: (file: string, ext: string) => boolean;

  /**
   * Whether this engine can handle the given language
   */
  claimsLanguage: (language: string) => boolean;

  /**
   * Whether this engine supports freezing
   */
  canFreeze: boolean;

  /**
   * Whether this engine generates figures
   */
  generatesFigures: boolean;

  /**
   * Directories to ignore during processing (optional)
   */
  ignoreDirs?: () => string[] | undefined;

  /**
   * Semver range specifying the minimum required Quarto version for this engine
   * Examples: ">= 1.6.0", "^1.5.0", "1.*"
   *
   * When specified, Quarto will check at engine registration time whether the
   * current version satisfies this requirement. If not, an error will be thrown.
   */
  quartoRequired?: string;

  /**
   * Populate engine-specific CLI commands (optional)
   * Called at module initialization to register commands like 'quarto enginename status'
   *
   * @param command - The CLI command to populate with subcommands
   */
  populateCommand?: (command: Command) => void;

  /**
   * Check installation and capabilities for this engine (optional)
   * Used by `quarto check <engine-name>` command
   *
   * Engines implementing this method will automatically be available as targets
   * for the check command (e.g., `quarto check jupyter`, `quarto check knitr`).
   *
   * @param conf - Check configuration with output settings and services
   */
  checkInstallation?: (conf: CheckConfiguration) => Promise<void>;

  /**
   * Launch a dynamic execution engine with project context
   * This is called when the engine is needed for execution
   *
   * @param context The restricted project context
   * @returns ExecutionEngineInstance that can execute documents
   */
  launch: (context: EngineProjectContext) => ExecutionEngineInstance;
}

/**
 * Interface for a launched execution engine
 * This represents an engine that has been instantiated with a project context
 * and is ready to execute documents
 */
export interface ExecutionEngineInstance {
  /**
   * Name of the engine
   */
  name: string;

  /**
   * Whether this engine supports freezing
   */
  canFreeze: boolean;

  /**
   * Get the markdown content for a file
   */
  markdownForFile(file: string): Promise<MappedString>;

  /**
   * Create an execution target for the given file
   */
  target: (
    file: string,
    quiet?: boolean,
    markdown?: MappedString,
  ) => Promise<ExecutionTarget | undefined>;

  /**
   * Get a partitioned view of the markdown
   */
  partitionedMarkdown: (
    file: string,
    format?: Format,
  ) => Promise<PartitionedMarkdown>;

  /**
   * Filter the format based on engine requirements
   */
  filterFormat?: (
    source: string,
    options: RenderOptions,
    format: Format,
  ) => Format;

  /**
   * Execute the target
   */
  execute: (options: ExecuteOptions) => Promise<ExecuteResult>;

  /**
   * Handle skipped execution targets
   */
  executeTargetSkipped?: (
    target: ExecutionTarget,
    format: Format,
  ) => void;

  /**
   * Get dependencies for the target
   */
  dependencies: (options: DependenciesOptions) => Promise<DependenciesResult>;

  /**
   * Post-process the execution result
   */
  postprocess: (options: PostProcessOptions) => Promise<void>;

  /**
   * Whether this engine can keep source for this target
   */
  canKeepSource?: (target: ExecutionTarget) => boolean;

  /**
   * Get a list of intermediate files generated by this engine
   */
  intermediateFiles?: (input: string) => string[] | undefined;

  /**
   * Run the engine (for interactivity)
   */
  run?: (options: RunOptions) => Promise<void>;

  /**
   * Post-render processing
   */
  postRender?: (file: RenderResultFile) => Promise<void>;
}
