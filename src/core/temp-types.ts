/*
 * temp-types.ts
 *
 * Copyright (C) 2022 Posit Software, PBC
 */

import type { TempOptions } from "../deno_ral/temp.ts";
export interface TempContext {
  baseDir: string;
  createFileFromString: (
    content: string,
    options?: TempOptions,
  ) => string;
  createFile: (options?: TempOptions) => string;
  createDir: (options?: TempOptions) => string;
  cleanup: () => void;
  onCleanup: (handler: VoidFunction) => void;
}
