/*
 * console-types.ts
 *
 * Copyright (C) 2020-2023 Posit Software, PBC
 */

export interface SpinnerOptions {
  message: string | (() => string);
  doneMessage?: string | boolean;
}
