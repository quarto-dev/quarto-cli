/*
 * parse-shortcode-types.ts
 *
 * Copyright (C) 2023 Posit Software, PBC
 */

export interface Shortcode {
  name: string;
  rawParams: {
    name?: string;
    value: string;
  }[];
  namedParams: Record<string, string>;
  params: string[];
}
