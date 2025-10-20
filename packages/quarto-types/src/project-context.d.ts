/**
 * Project context interfaces for Quarto engines
 */

import { MappedString } from './text-types';
import { kProjectOutputDir } from './constants';
import { ExecutionEngine } from './execution-engine';

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
    engines?: string[];
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
  readYamlFromMarkdown: (markdown: string | MappedString) => Promise<import('./metadata-types').Metadata>;

  /**
   * Split markdown into YAML, headings, and content
   *
   * @param markdown - Markdown content
   * @returns Partitioned markdown object
   */
  partitionMarkdown: (markdown: string) => import('./execution-engine').PartitionedMarkdown;

  /**
   * Read a file with source mapping information
   *
   * @param path - Path to the file
   * @returns Mapped string with source information
   */
  readMappedFile: (path: string) => MappedString;

  /**
   * Normalize newlines in markdown while maintaining source mapping
   *
   * @param markdown - Mapped string to normalize
   * @returns Normalized mapped string
   */
  normalizeMarkdown: (markdown: MappedString) => MappedString;

  /**
   * Get the output directory for the project
   *
   * @returns Path to output directory
   */
  getOutputDirectory: () => string;

  /**
   * Create a mapped string from text
   *
   * @param text - Text content
   * @param fileName - Optional filename
   * @returns Mapped string
   */
  createMappedString: (text: string, fileName?: string) => MappedString;
}