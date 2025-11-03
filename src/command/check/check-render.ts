/*
 * check-render.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { render } from "../render/render-shared.ts";
import type { RenderServiceWithLifetime } from "../render/types.ts";

/**
 * Options for test-rendering a document during check operations
 */
export interface CheckRenderOptions {
  /** Markdown content to render */
  content: string;
  /** Language identifier (e.g., "python", "r", "julia") */
  language: string;
  /** Render services for temp file management and rendering */
  services: RenderServiceWithLifetime;
}

/**
 * Result of a check render operation
 */
export interface CheckRenderResult {
  /** Whether the render succeeded */
  success: boolean;
  /** Error if render failed */
  error?: Error;
}

/**
 * Test-render a document for validation during check operations
 *
 * Creates a temporary file with the provided content, renders it with
 * appropriate engine settings, and returns success/failure status.
 * Used by checkInstallation implementations to verify engines work.
 */
export async function checkRender(
  options: CheckRenderOptions,
): Promise<CheckRenderResult> {
  const { content, services } = options;

  // Create temporary file
  const tempFile = services.temp.createFile({ suffix: ".qmd" });

  // Write content to file
  Deno.writeTextFileSync(tempFile, content);

  // Render with appropriate flags
  const result = await render(tempFile, {
    services,
    flags: { quiet: true, executeDaemon: 0 },
  });

  // Return simplified result
  return {
    success: !result.error,
    error: result.error,
  };
}
