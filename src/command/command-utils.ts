/*
 * command-utils.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { initYamlIntelligenceResourcesFromFilesystem } from "../core/schema/utils.ts";
import { projectContext } from "../project/project-context.ts";
import { notebookContext } from "../render/notebook/notebook-context.ts";
import { reorderEngines } from "../execute/engine.ts";
import { ProjectContext } from "../project/types.ts";

/**
 * Initialize project context and register external engines from project config.
 *
 * This consolidates the common pattern of:
 * 1. Loading YAML intelligence resources
 * 2. Creating project context
 * 3. Registering external engines via reorderEngines()
 *
 * @param dir - Optional directory path (defaults to current working directory)
 * @returns ProjectContext if a project is found, undefined otherwise
 */
export async function initializeProjectContextAndEngines(
  dir?: string,
): Promise<ProjectContext | undefined> {
  // Initialize YAML intelligence resources (required for project context)
  await initYamlIntelligenceResourcesFromFilesystem();

  // Load project context if we're in a project directory
  const project = await projectContext(dir || Deno.cwd(), notebookContext());

  // Register external engines from project config
  if (project) {
    await reorderEngines(project);
  }

  return project;
}
