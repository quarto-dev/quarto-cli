/**
 * Execution engine interfaces for Quarto
 */

import { MappedString } from "./text-types";
import { Format, Metadata } from "./metadata-types";
import { EngineProjectContext } from "./project-context";
import type { Command } from "./cli-types";
import type { QuartoAPI } from "./quarto-api";

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
 * Valid Pandoc include locations
 */
export type PandocIncludeLocation =
  | "include-in-header"
  | "include-before-body"
  | "include-after-body";

/**
 * Pandoc includes for headers, body, etc.
 * Mapped type that allows any of the valid include locations
 */
export type PandocIncludes = {
  [K in PandocIncludeLocation]?: string[];
};

/**
 * Options for execution
 */
export interface ExecuteOptions {
  /** The execution target */
  target: ExecutionTarget;

  /** Format to render to */
  format: Format;

  /** Directory for resources */
  resourceDir: string;

  /** Directory for temporary files */
  tempDir: string;

  /** Whether to include dependencies */
  dependencies: boolean;

  /** Project directory if applicable */
  projectDir?: string;

  /** Library directory */
  libDir?: string;

  /** Current working directory */
  cwd: string;

  /** Parameters passed to document */
  params?: { [key: string]: unknown };

  /** Whether to suppress output */
  quiet?: boolean;

  /** Whether execution is for preview server */
  previewServer?: boolean;

  /** List of languages handled by cell language handlers */
  handledLanguages: string[];

  /** Project context */
  project: EngineProjectContext;
}

/**
 * Result of execution
 */
export interface ExecuteResult {
  /** Resulting markdown content */
  markdown: string;

  /** Supporting files */
  supporting: string[];

  /** Filter scripts */
  filters: string[];

  /** Updated metadata */
  metadata?: Metadata;

  /** Pandoc options */
  pandoc?: Record<string, unknown>;

  /** Pandoc includes */
  includes?: PandocIncludes;

  /** Engine name */
  engine?: string;

  /** Engine-specific dependencies */
  engineDependencies?: Record<string, Array<unknown>>;

  /** Content to preserve during processing */
  preserve?: Record<string, string>;

  /** Whether post-processing is required */
  postProcess?: boolean;

  /** Additional resource files */
  resourceFiles?: string[];
}

/**
 * Options for retrieving dependencies
 */
export interface DependenciesOptions {
  /** The execution target */
  target: ExecutionTarget;

  /** Format to render to */
  format: Format;

  /** Output file path */
  output: string;

  /** Directory for resources */
  resourceDir: string;

  /** Directory for temporary files */
  tempDir: string;

  /** Project directory if applicable */
  projectDir?: string;

  /** Library directory */
  libDir?: string;

  /** Dependencies to include */
  dependencies?: Array<unknown>;

  /** Whether to suppress output */
  quiet?: boolean;
}

/**
 * Result of retrieving dependencies
 */
export interface DependenciesResult {
  /** Pandoc includes */
  includes: PandocIncludes;
}

/**
 * Options for post-processing
 */
export interface PostProcessOptions {
  /** The execution engine */
  engine: ExecutionEngineInstance;

  /** The execution target */
  target: ExecutionTarget;

  /** Format to render to */
  format: Format;

  /** Output file path */
  output: string;

  /** Directory for temporary files */
  tempDir: string;

  /** Project directory if applicable */
  projectDir?: string;

  /** Content to preserve during processing */
  preserve?: Record<string, string>;

  /** Whether to suppress output */
  quiet?: boolean;
}

/**
 * Options for running the engine
 */
export interface RunOptions {
  /** Input file path */
  input: string;

  /** Whether to render */
  render: boolean;

  /** Whether to open in browser */
  browser: boolean;

  /** Directory for temporary files */
  tempDir: string;

  /** Whether to reload */
  reload?: boolean;

  /** Target format */
  format?: string;

  /** Project directory if applicable */
  projectDir?: string;

  /** Port for server */
  port?: number;

  /** Host for server */
  host?: string;

  /** Whether to suppress output */
  quiet?: boolean;

  /** Callback when ready */
  onReady?: () => Promise<void>;
}

/**
 * Render flags (extends pandoc flags)
 */
export interface RenderFlags {
  // Output options
  outputDir?: string;
  siteUrl?: string;
  executeDir?: string;

  // Execution options
  execute?: boolean;
  executeCache?: true | false | "refresh";
  executeDaemon?: number;
  executeDaemonRestart?: boolean;
  executeDebug?: boolean;
  useFreezer?: boolean;

  // Metadata
  metadata?: { [key: string]: unknown };
  pandocMetadata?: { [key: string]: unknown };
  params?: { [key: string]: unknown };
  paramsFile?: string;

  // Other flags
  clean?: boolean;
  debug?: boolean;
  quiet?: boolean;
  version?: string;

  // Pandoc-specific flags (subset)
  to?: string;
  output?: string;
  [key: string]: unknown; // Allow other pandoc flags
}

/**
 * Render options (simplified)
 * Note: The internal Quarto version includes a 'services' field with
 * RenderServices, which has been omitted as it requires internal dependencies.
 */
export interface RenderOptions {
  flags?: RenderFlags;
  pandocArgs?: string[];
  progress?: boolean;
  useFreezer?: boolean;
  devServerReload?: boolean;
  previewServer?: boolean;
  setProjectDir?: boolean;
  forceClean?: boolean;
  echo?: boolean;
  warning?: boolean;
  quietPandoc?: boolean;
}

/**
 * Result file from rendering
 */
export interface RenderResultFile {
  /** Input file path */
  input: string;

  /** Markdown content */
  markdown: string;

  /** Format used for rendering */
  format: Format;

  /** Output file path */
  file: string;

  /** Whether this is a transient file */
  isTransient?: boolean;

  /** Supporting files generated */
  supporting?: string[];

  /** Resource files */
  resourceFiles: string[];

  /** Whether this is a supplemental file */
  supplemental?: boolean;
}

/**
 * A partitioned markdown document
 */
export interface PartitionedMarkdown {
  /** YAML frontmatter as parsed metadata */
  yaml?: Metadata;

  /** Text of the first heading */
  headingText?: string;

  /** Attributes of the first heading */
  headingAttr?: {
    id: string;
    classes: string[];
    keyvalue: Array<[string, string]>;
  };

  /** Whether the document contains references */
  containsRefs: boolean;

  /** Complete markdown content */
  markdown: string;

  /** Markdown without YAML frontmatter */
  srcMarkdownNoYaml: string;
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
   * Populate engine-specific CLI commands (optional)
   * Called at module initialization to register commands like 'quarto enginename status'
   *
   * @param command - The CLI command to populate with subcommands
   */
  populateCommand?: (command: Command) => void;

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
