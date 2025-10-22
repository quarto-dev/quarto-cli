/**
 * Project context interfaces for Quarto engines
 */

import { MappedString } from './text-types';
import { kProjectOutputDir } from './constants';
import { ExecutionEngine } from './execution-engine';
import { ExternalEngine } from './external-engine';

/**
 * Information about a file being processed
 */
export interface FileInformation {
  /**
   * Full markdown content after expanding includes
   */
  fullMarkdown?: MappedString;

  /**
   * Map of file inclusions
   */
  includeMap?: {
    source: string;
    target: string;
  }[];

  /**
   * The launched execution engine for this file
   */
  engine?: import('./execution-engine').LaunchedExecutionEngine;

  /**
   * The execution target for this file
   */
  target?: import('./execution-engine').ExecutionTarget;

  /**
   * Document metadata
   */
  metadata?: import('./metadata-types').Metadata;
}

/**
 * A restricted version of ProjectContext that only exposes
 * functionality needed by execution engines.
 */
export interface EngineProjectContext {
  /**
   * Base directory of the project
   */
  dir: string;

  /**
   * Flag indicating if project consists of a single file
   */
  isSingleFile: boolean;

  /**
   * Config object containing project configuration
   * Used primarily for config?.engines access
   */
  config?: {
    engines?: (string | ExternalEngine)[];
    project?: {
      [kProjectOutputDir]?: string;
    };
  };

  /**
   * For file information cache management
   * Used for the transient notebook tracking in Jupyter
   */
  fileInformationCache: Map<string, FileInformation>;

  /**
   * Get the output directory for the project
   *
   * @returns Path to output directory
   */
  getOutputDirectory: () => string;

  /**
   * Resolves full markdown content for a file, including expanding includes
   *
   * @param engine - The execution engine
   * @param file - Path to the file
   * @param markdown - Optional existing markdown content
   * @param force - Whether to force re-resolution even if cached
   * @returns Promise resolving to mapped markdown string
   */
  resolveFullMarkdownForFile: (
    engine: ExecutionEngine | undefined,
    file: string,
    markdown?: MappedString,
    force?: boolean,
  ) => Promise<MappedString>;

  /**
   * Extract and parse YAML frontmatter from markdown
   *
   * @param markdown - Markdown content with YAML frontmatter
   * @returns Parsed metadata object
   */
  readYamlFromMarkdown: (markdown: string) => import('./metadata-types').Metadata;

  /**
   * Split markdown into YAML, headings, and content
   *
   * @param markdown - Markdown content
   * @returns Partitioned markdown object
   */
  partitionMarkdown: (markdown: string) => import('./execution-engine').PartitionedMarkdown;

  /**
   * Extract languages used in markdown code blocks
   *
   * @param markdown - Markdown content to analyze
   * @returns Set of language identifiers found in code blocks
   */
  languagesInMarkdown: (markdown: string) => Set<string>;

  /**
   * Normalize newlines in markdown while maintaining source mapping
   *
   * @param markdown - Mapped string to normalize
   * @returns Normalized mapped string
   */
  normalizeMarkdown: (markdown: MappedString) => MappedString;

  /**
   * Create a mapped string from text
   *
   * @param text - Text content
   * @param fileName - Optional filename
   * @returns Mapped string
   */
  mappedStringFromString: (text: string, fileName?: string) => MappedString;

  /**
   * Read a file and create a mapped string from its contents
   *
   * @param path - Path to the file
   * @returns Mapped string with source information
   */
  mappedStringFromFile: (path: string) => MappedString;
}