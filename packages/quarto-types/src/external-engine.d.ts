/**
 * External engine type for Quarto
 */

/**
 * Configuration for an external execution engine
 */
export interface ExternalEngine {
  /**
   * URL to the TypeScript module for the execution engine
   * This should point to a module that exports an ExecutionEngine implementation
   */
  url: string;
}