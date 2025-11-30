/*
 * command-utils.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { initYamlIntelligenceResourcesFromFilesystem } from "../core/schema/utils.ts";
import { projectContext } from "../project/project-context.ts";
import { notebookContext } from "../render/notebook/notebook-context.ts";
import { resolveEngines } from "../execute/engine.ts";
import type { ProjectContext } from "../project/types.ts";

/**
 * Create a minimal "zero-file" project context for loading bundled engine extensions
 * when no actual project or file exists.
 *
 * This is needed for commands like `quarto check julia` that run outside any project
 * but still need access to bundled engines. The context provides just enough structure
 * to discover and register bundled engine extensions.
 *
 * @param dir - Directory to use as the base (defaults to current working directory)
 * @returns A minimal ProjectContext with bundled engines loaded
 */
async function zeroFileProjectContext(dir?: string): Promise<ProjectContext> {
  const { createExtensionContext } = await import(
    "../extension/extension.ts"
  );
  const { resolveEngineExtensions } = await import(
    "../project/project-context.ts"
  );

  const extensionContext = createExtensionContext();
  const config = await resolveEngineExtensions(
    extensionContext,
    { project: {} },
    dir || Deno.cwd(),
  );

  // Return a minimal project context with the resolved engine config
  return {
    dir: dir || Deno.cwd(),
    config,
  } as ProjectContext;
}

/**
 * Initialize project context and register external engines from project config.
 *
 * This consolidates the common pattern of:
 * 1. Loading YAML intelligence resources
 * 2. Creating project context
 * 3. Registering external engines via reorderEngines()
 *
 * If no project is found, a zero-file context is created to load bundled engine
 * extensions (like Julia), ensuring they're available for commands like `quarto check julia`.
 *
 * @param dir - Optional directory path (defaults to current working directory)
 */
export async function initializeProjectContextAndEngines(
  dir?: string,
): Promise<void> {
  // Initialize YAML intelligence resources (required for project context)
  await initYamlIntelligenceResourcesFromFilesystem();

  // Load project context if we're in a project directory, or create a zero-file
  // context to load bundled engines when no project exists
  const context = await projectContext(dir || Deno.cwd(), notebookContext()) ||
    await zeroFileProjectContext(dir);

  // Register external engines from project config
  await resolveEngines(context);
}
