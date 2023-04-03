/*
 * extension-shared.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { ExtensionId } from "./types.ts";

export function extensionIdString(extensionId: ExtensionId) {
  if (extensionId.organization) {
    return `${extensionId.organization}/${extensionId.name}`;
  } else {
    return extensionId.name;
  }
}
