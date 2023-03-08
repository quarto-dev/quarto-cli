/*
* temp-types.ts
*
* Copyright (C) 2022-2023 Posit, PBC
*
*/

export interface TempContext {
  createFile: (options?: Deno.MakeTempOptions) => string;
  createDir: (options?: Deno.MakeTempOptions) => string;
  cleanup: () => void;
}
