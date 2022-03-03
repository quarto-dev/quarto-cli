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

import { initYamlIntelligence } from "../lib/yaml-intelligence/yaml-intelligence.ts";

// initializes yaml intelligence using precompiled schemas from the filesystem
export async function initYamlIntelligenceResourcesFromFilesystem() {
  const resourceModule = (await import(
    resourcePath("editor/tools/yaml/yaml-intelligence-resources.json"),
    {
      assert: { type: "json" },
    }
  )).default as Record<string, unknown>;
  await initYamlIntelligence({
    resourceModule,
  });
}
