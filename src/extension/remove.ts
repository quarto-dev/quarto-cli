/*
* remove.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { Extension } from "./extension-shared.ts";

export function removeExtension(extension: Extension) {
  return Deno.remove(extension.path, { recursive: true });
}
