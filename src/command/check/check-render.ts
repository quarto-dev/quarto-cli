/*
 * check-render.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { render } from "../render/render-shared.ts";
import type {
  CheckRenderOptions,
  CheckRenderResult,
} from "../../../packages/quarto-types/src/check.ts";

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
  // Cast services to any to avoid type mismatch - CheckRenderServiceWithLifetime
  // is a simplified version that contains what render() needs
  const result = await render(tempFile, {
    services: services as any,
    flags: { quiet: true, executeDaemon: 0 },
  });

  // Return simplified result
  return {
    success: !result.error,
    error: result.error,
  };
}
