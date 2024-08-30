/*
 * write.ts
 *
 * Copyright (C)2024 Posit Software, PBC
 */

export function writeTextFileSyncPreserveMode(
  path: string,
  data: string,
  options?: Deno.WriteFileOptions | undefined,
): void {
  // Preserve the existing permissions if possible
  // See https://github.com/quarto-dev/quarto-cli/issues/660
  let mode;
  if (Deno.build.os !== "windows") {
    const stat = Deno.statSync(path);
    if (stat.mode !== null) {
      mode = stat.mode;
    }
  }

  if (mode !== undefined) {
    options = { ...options, mode }; // Merge provided options with mode
  }

  Deno.writeTextFileSync(path, data, options);
}
