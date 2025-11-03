/**
 * Check command types for Quarto
 */

import type { TempContext } from "./system.ts";

/**
 * Render services available during check operations
 * Simplified version containing only what check operations need
 */
export interface CheckRenderServices {
  /** Temporary file management */
  temp: TempContext;

  /** Placeholder for extension context (not used by check) */
  extension?: unknown;

  /** Placeholder for notebook context (not used by check) */
  notebook?: unknown;
}

/**
 * Render services with cleanup capability
 */
export interface CheckRenderServiceWithLifetime extends CheckRenderServices {
  /** Cleanup function to release resources */
  cleanup: () => void;

  /** Optional lifetime management */
  lifetime?: unknown;
}

/**
 * Configuration for check command operations
 * Used by engines implementing checkInstallation()
 */
export interface CheckConfiguration {
  /** Whether to run strict checks */
  strict: boolean;

  /** Target being checked (e.g., "jupyter", "knitr", "all") */
  target: string;

  /** Optional output file path for JSON results */
  output: string | undefined;

  /** Render services (primarily for temp file management) */
  services: CheckRenderServiceWithLifetime;

  /** JSON result object (undefined if not outputting JSON) */
  jsonResult: Record<string, unknown> | undefined;
}
