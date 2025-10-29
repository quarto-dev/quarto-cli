/**
 * External engine interfaces for Quarto
 */

/**
 * Represents an external engine specified in a project
 */
export interface ExternalEngine {
  /**
   * Path to the engine implementation
   */
  path: string;
}