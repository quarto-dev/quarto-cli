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
 * Format identifier information
 */
export interface FormatIdentifier {
  "base-format"?: string;
  "target-format"?: string;
  "display-name"?: string;
  "extension-name"?: string;
}

/**
 * Format language/localization strings
 */
export interface FormatLanguage {
  [key: string]: string | undefined;
}

/**
 * Complete Format type for engine interfaces
 */
export interface Format {
  /**
   * Format identifier
   */
  identifier: FormatIdentifier;

  /**
   * Format language/localization strings
   */
  language: FormatLanguage;

  /**
   * Document metadata
   */
  metadata: Metadata;
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