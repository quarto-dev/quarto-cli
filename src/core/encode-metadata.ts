/*
 * encode-metadata.ts
 *
 * Copyright (C) 2022 Posit Software, PBC
 */
import { encode as base64Encode } from "encoding/base64";

export function encodeMetadata(
  metadata: Record<string, unknown>,
): string {
  const encoded = base64Encode(JSON.stringify(metadata));
  return `\n\n\`<!-- quarto-file-metadata: ${encoded} -->\`{=html}\n\n\`\`\`{=html}\n<!-- quarto-file-metadata: ${encoded} -->\n\`\`\`\n\n`;
}
