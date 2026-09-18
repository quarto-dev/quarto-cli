/*
 * original-real-path.ts
 *
 * Copyright (C) 2020-2025 Posit Software, PBC
 *
 * Saves original Deno.realPathSync before monkey-patching.
 * This module MUST be imported in quarto.ts BEFORE monkey-patch.ts.
 *
 * DO NOT add any imports to this file - it must remain dependency-free
 * to avoid circular import issues.
 */
export const originalRealPathSync: typeof Deno.realPathSync = Deno.realPathSync;
