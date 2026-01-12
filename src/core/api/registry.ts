// src/core/api/registry.ts

import type {
  NamespaceProviders,
  ProviderFunction,
  QuartoAPI,
} from "./types.ts";

/**
 * Error thrown when attempting to access an unregistered namespace
 */
export class UnregisteredNamespaceError extends Error {
  constructor(namespace: string) {
    super(
      `QuartoAPI namespace '${namespace}' has not been registered. ` +
        `Ensure that 'src/core/api/register.ts' is imported before using the API.`,
    );
    this.name = "UnregisteredNamespaceError";
  }
}

/**
 * Error thrown when attempting to register after API has been finalized
 */
export class RegistryFinalizedError extends Error {
  constructor(namespace: string) {
    super(
      `Cannot register namespace '${namespace}': Registry has been finalized. ` +
        `All registrations must occur before createAPI() is called.`,
    );
    this.name = "RegistryFinalizedError";
  }
}

/**
 * Generic registry for QuartoAPI namespaces using dependency inversion pattern
 */
export class QuartoAPIRegistry {
  private providers: NamespaceProviders = {};
  private implementations: Partial<QuartoAPI> = {};
  private finalized = false;
  private apiInstance: QuartoAPI | null = null;

  /**
   * Register a namespace provider function
   * @throws {RegistryFinalizedError} if registry is already finalized
   * @throws {Error} if namespace is already registered
   */
  register<K extends keyof QuartoAPI>(
    namespace: K,
    provider: ProviderFunction<QuartoAPI[K]>,
  ): void {
    if (this.finalized) {
      throw new RegistryFinalizedError(namespace);
    }

    if (this.providers[namespace]) {
      throw new Error(
        `QuartoAPI namespace '${namespace}' is already registered`,
      );
    }

    // deno-lint-ignore no-explicit-any
    (this.providers as any)[namespace] = provider;
  }

  /**
   * Create the QuartoAPI instance with eager initialization and validation
   * @returns {QuartoAPI} The complete API object with all namespaces
   * @throws {UnregisteredNamespaceError} if any required namespace is missing
   */
  createAPI(): QuartoAPI {
    // Return cached instance if already created
    if (this.apiInstance) {
      return this.apiInstance;
    }

    // List of all required namespaces
    const requiredNamespaces: Array<keyof QuartoAPI> = [
      "markdownRegex",
      "mappedString",
      "jupyter",
      "format",
      "path",
      "system",
      "text",
      "console",
      "crypto",
    ];

    // Validate all required namespaces are registered
    const missingNamespaces = requiredNamespaces.filter(
      (ns) => !this.providers[ns],
    );

    if (missingNamespaces.length > 0) {
      throw new UnregisteredNamespaceError(
        `Missing required namespaces: ${missingNamespaces.join(", ")}`,
      );
    }

    // Eagerly initialize all namespaces by calling provider functions
    for (const namespace of requiredNamespaces) {
      const provider = this.providers[namespace];
      if (provider) {
        // deno-lint-ignore no-explicit-any
        (this.implementations as any)[namespace] = provider();
      }
    }

    // Mark registry as finalized
    this.finalized = true;

    // Create and cache the API instance
    this.apiInstance = this.implementations as QuartoAPI;

    return this.apiInstance;
  }

  /**
   * Check if a namespace is registered (useful for optional features)
   */
  isRegistered(namespace: keyof QuartoAPI): boolean {
    return !!this.providers[namespace];
  }

  /**
   * Clear cached implementations (for testing purposes)
   */
  clearCache(): void {
    this.implementations = {};
    this.apiInstance = null;
    this.finalized = false;
  }
}

/**
 * Global registry instance
 */
export const globalRegistry = new QuartoAPIRegistry();
