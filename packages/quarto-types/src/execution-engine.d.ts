/**
 * Execution engine interfaces for Quarto
 */

import { MappedString } from "./text-types";
import { Format, Metadata } from "./metadata-types";
import { EngineProjectContext } from "./project-context";

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
 * Pandoc includes for headers, body, etc.
 */
export interface PandocIncludes {
  /** Content to include in header */
  "include-in-header"?: string[];

  /** Content to include before body */
  "include-before-body"?: string[];

  /** Content to include after body */
  "include-after-body"?: string[];
}

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
    options: any,
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
  postRender?: (file: any) => Promise<void>;
}
