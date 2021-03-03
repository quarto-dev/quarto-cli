/*
* render.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { dirAndStem } from "./path.ts";

export function inputFilesDir(input: string) {
  const [_, stem] = dirAndStem(input);
  return stem + "_files";
}
