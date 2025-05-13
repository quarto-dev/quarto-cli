/*
 * temp-types.ts
 *
 * Copyright (C) 2022 Posit Software, PBC
 */

export interface TempContext {
  baseDir: string;
  createFileFromString: (
    content: string,
    options?: Deno.MakeTempOptions,
  ) => string;
  createFile: (options?: Deno.MakeTempOptions) => string;
  createDir: (options?: Deno.MakeTempOptions) => string;
  cleanup: () => void;
  onCleanup: (handler: VoidFunction) => void;
}
