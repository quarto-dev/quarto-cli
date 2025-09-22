/**
 * Basic metadata types used across Quarto
 */

/**
 * Generic metadata key-value store
 */
export type Metadata = {
  [key: string]: unknown;
};

/**
 * Minimal Format type - just enough for engine interfaces
 */
export interface Format {
  /**
   * Format rendering options
   */
  render?: Record<string, unknown>;

  /**
   * Format execution options
   */
  execute: Record<string, unknown>;

  /**
   * Format pandoc options
   */
  pandoc: {
    to?: string;
    [key: string]: unknown;
  };
}