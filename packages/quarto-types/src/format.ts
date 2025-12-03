/**
 * Format type definitions for Quarto output formats
 */

import type { Metadata } from "./metadata.ts";

/**
 * Valid format identifier keys
 */
export type FormatIdentifierKey =
  | "base-format"
  | "target-format"
  | "display-name"
  | "extension-name";

/**
 * Format identifier information
 */
export type FormatIdentifier = {
  [K in FormatIdentifierKey]?: string;
};

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
  render: Record<string, unknown>;

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
