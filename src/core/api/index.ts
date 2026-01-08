// src/core/api/index.ts
//
// Main entry point for QuartoAPI
// This module exports the global quartoAPI instance and all related types

import { globalRegistry } from "./registry.ts";
import type { QuartoAPI } from "./types.ts";

// Export all types for external use
export type {
  ConsoleNamespace,
  CryptoNamespace,
  FormatNamespace,
  JupyterNamespace,
  MappedStringNamespace,
  MarkdownRegexNamespace,
  PathNamespace,
  QuartoAPI,
  SystemNamespace,
  TextNamespace,
} from "./types.ts";

// Export registry utilities (mainly for testing)
export {
  globalRegistry,
  QuartoAPIRegistry,
  RegistryFinalizedError,
  UnregisteredNamespaceError,
} from "./registry.ts";

/**
 * The global QuartoAPI instance (cached after first call)
 */
let _quartoAPI: QuartoAPI | null = null;

/**
 * Get the global QuartoAPI instance
 *
 * This function returns the QuartoAPI instance, creating it on first call.
 * The register.ts module (imported in src/quarto.ts) ensures all
 * namespaces are registered before any code accesses the API.
 *
 * @returns {QuartoAPI} The complete API object with all namespaces
 */
export function getQuartoAPI(): QuartoAPI {
  if (_quartoAPI === null) {
    _quartoAPI = globalRegistry.createAPI();
  }
  return _quartoAPI;
}
