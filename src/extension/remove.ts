/*
 * remove.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { basename, dirname } from "../deno_ral/path.ts";
import { removeIfEmptyDir } from "../core/path.ts";
import { kBuiltInExtOrg, kExtensionDir } from "./constants.ts";
import { Extension } from "./types.ts";

export async function removeExtension(extension: Extension) {
  // You can't remove quarto extensions
  if (extension.id.organization === kBuiltInExtOrg) {
    throw new Error(
      `The extension ${extension.title} can't be removed since it is a built in extension.`,
    );
  }

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
