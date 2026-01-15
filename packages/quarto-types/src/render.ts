/**
 * Rendering types for Quarto
 */

import type { Format } from "./format.ts";

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
