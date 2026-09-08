/*
 * format-utils.ts
 *
 * Test utilities for constructing a minimal Format object for unit tests.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { createFormat } from "../../src/format/formats-shared.ts";
import { Format } from "../../src/config/types.ts";

export function createMockFormat(
  overrides: Record<string, unknown> = {},
): Format {
  return createFormat("Test Format", "html", overrides);
}
