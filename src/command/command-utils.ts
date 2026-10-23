/*
 * command-utils.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { initYamlIntelligenceResourcesFromFilesystem } from "../core/schema/utils.ts";
import {
  frameInputWalkError,
  type ProjectConfigResolution,
  resolveEngineExtensions,
  resolveProjectConfig,
} from "../project/project-context.ts";
import { createExtensionContext } from "../extension/extension.ts";
import { resolveEngines } from "../execute/engine.ts";
import { normalizePath } from "../core/path.ts";
import type { ProjectConfig } from "../project/types.ts";

/**
 * Resolve a config holding only the bundled engine extensions, for use when
 * no project exists.
 *
 * This is needed for commands like `quarto check julia` that run outside any project
 * but still need access to bundled engines.
 *
 * @param dir - Directory to use as the base
 * @returns A project config with bundled engines loaded
 */
function bundledEngineConfig(dir: string): Promise<ProjectConfig> {
  return resolveEngineExtensions(
    createExtensionContext(),
    { project: {} },
    dir,
  );
}

/**
 * Initialize project configuration and register external engines from it.
 *
 * This consolidates the common pattern of:
 * 1. Loading YAML intelligence resources
 * 2. Resolving the project configuration (without walking project input files)
 * 3. Registering external engines via reorderEngines()
 *
 * If no project is found, a config with only the bundled engine extensions
 * (like Julia) is used, ensuring they're available for commands like `quarto check julia`.
 *
 * @param dir - Optional directory path (defaults to current working directory)
 * @returns The resolved project configuration, or undefined when no project is found
 */
export async function initializeProjectContextAndEngines(
  dir?: string,
): Promise<ProjectConfigResolution | undefined> {
  // Initialize YAML intelligence resources (required for project config)
  await initYamlIntelligenceResourcesFromFilesystem();

  // Use the project config if we're in a project directory, or load only
  // the bundled engines when no project exists
  const baseDir = normalizePath(dir || Deno.cwd());
  const resolved = await resolveProjectConfig(baseDir);
  const config = resolved?.config ?? await bundledEngineConfig(baseDir);

  // Register external engines from project config
  await resolveEngines({ config });

  return resolved;
}

/**
 * Wraps a command action so a permission error from the project input walk
 * is reported as a framed error naming the project and its _quarto.yml.
 */
export function withInputWalkErrorFraming<A extends unknown[]>(
  action: (...args: A) => Promise<void>,
): (...args: A) => Promise<void> {
  return async (...args: A) => {
    try {
      await action(...args);
    } catch (e) {
      throw frameInputWalkError(e);
    }
  };
}
