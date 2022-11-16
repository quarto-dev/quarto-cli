/*
* utils.ts
*
* Copyright (C) 2021-2022 Posit Software, PBC
*
*/

import { toFileUrl } from "path/mod.ts";
import { resourcePath } from "../resources.ts";
import { join } from "path/mod.ts";
import { initTreeSitter } from "./deno-init-tree-sitter.ts";
import { initYamlIntelligence } from "../lib/yaml-intelligence/yaml-intelligence.ts";

export function schemaPath(path: string) {
  return resourcePath(join("schema", path));
}

// initializes yaml intelligence using precompiled schemas from the filesystem
export async function initYamlIntelligenceResourcesFromFilesystem() {
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
