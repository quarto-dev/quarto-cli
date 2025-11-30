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
 * The global QuartoAPI instance
 *
 * This is created lazily on first access via a getter.
 * The register.ts module (imported in src/quarto.ts) ensures all
 * namespaces are registered before any code accesses the API.
 */
let _quartoAPI: QuartoAPI | null = null;

export const quartoAPI = new Proxy({} as QuartoAPI, {
  get(_target, prop) {
    // Create API on first access
    if (_quartoAPI === null) {
      _quartoAPI = globalRegistry.createAPI();
    }
    return _quartoAPI[prop as keyof QuartoAPI];
  },
});
