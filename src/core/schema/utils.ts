/*
* utils.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { toFileUrl } from "path/mod.ts";
import { resourcePath } from "../resources.ts";
import { join } from "path/mod.ts";
import { initTreeSitter } from "../lib/yaml-validation/deno-init-tree-sitter.ts";
import { initYamlIntelligence } from "../lib/yaml-intelligence/yaml-intelligence.ts";

export function schemaPath(path: string) {
  return resourcePath(join("schema", path));
}

// initializes yaml intelligence using precompiled schemas from the filesystem
export async function initYamlIntelligenceResourcesFromFilesystem() {
  // 2022-08-26: There seems to be a bug on `deno vendor` for 1.25.0 where it fails to take json imports correctly.
  // we need to work around it during the vendoring process by removing the bogus imports like so:
  //
  // const resourceModule = {} as Record<string, unknown>;

  const resourceModule = (await import(
    toFileUrl(
      resourcePath("editor/tools/yaml/yaml-intelligence-resources.json"),
    ).href,
    {
      assert: { type: "json" },
    }
  )).default as Record<string, unknown>;

  await initYamlIntelligence({
    resourceModule,
  });

  await initTreeSitter();
}
