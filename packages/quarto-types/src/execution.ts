/**
 * Execution workflow types for Quarto engines
 */

import type { MappedString } from "./text.ts";
import type { Format } from "./format.ts";
import type { Metadata } from "./metadata.ts";
import type { ExecutionTarget, ExecutionEngineInstance } from "./execution-engine.ts";
import type { EngineProjectContext } from "./project-context.ts";
import type { PandocIncludes } from "./pandoc.ts";

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
