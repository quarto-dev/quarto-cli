/*
 * brand.ts
 *
 * Schema for _brand.yml
 *
 * Copyright (C) 2024 Posit Software, PBC
 */

import { refSchema } from "./common.ts";
import { ConcreteSchema } from "./types.ts";

// deno-lint-ignore require-await
export const getBrandConfigSchema: () => Promise<
  ConcreteSchema
> = async () => {
  return refSchema("brand", "");
};
