/*
* temp-types.ts
*
* Copyright (C) 2022 Posit Software, PBC
*
*/

export interface TempContext {
  createFile: (options?: Deno.MakeTempOptions) => string;
  createDir: (options?: Deno.MakeTempOptions) => string;
  cleanup: () => void;
}
