/*
* remove.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { basename, dirname } from "path/mod.ts";
import { removeIfEmptyDir } from "../core/path.ts";
import { Extension, kExtensionDir } from "./extension-shared.ts";

export async function removeExtension(extension: Extension) {
  // Delete the extension
  await Deno.remove(extension.path, { recursive: true });

  // Remove the container directory, if empty
  const extensionDir = dirname(extension.path);
  removeIfEmptyDir(extensionDir);

  // If the parent directory is an _extensions directory which is itself empty
  // remove that too
  const parentDir = dirname(extensionDir);
  if (parentDir && basename(parentDir) === kExtensionDir) {
    removeIfEmptyDir(parentDir);
  }
}
