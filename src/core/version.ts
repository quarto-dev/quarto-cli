/*
* version.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { existsSync } from "fs/exists.ts";
import { join } from "path/mod.ts";

import { resourcePath } from "./resources.ts";

export function version() {
  const versionPath = join(resourcePath(), "version");
  if (existsSync(versionPath)) {
    return Deno.readTextFileSync(versionPath);
  } else {
    return "No version";
  }
}
