/*
* utils.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { resourcePath } from "../resources.ts";
import { join } from "path/mod.ts";

export function schemaPath(path: string) {
  return resourcePath(join("schema", path));
}
