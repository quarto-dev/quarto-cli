/*
 * errors-types.ts
 *
 * Copyright (C) 2021-2023 Posit Software, PBC
 */

export interface ErrorLocation {
  start: {
    line: number;
    column: number;
  };
  end: {
    line: number;
    column: number;
  };
}

export interface TidyverseError {
  heading: string;
  error: string[];
  info: Record<string, string>; // use tag for infos to only display one error of each tag
  fileName?: string;
  location?: ErrorLocation;
  sourceContext?: string;
}
