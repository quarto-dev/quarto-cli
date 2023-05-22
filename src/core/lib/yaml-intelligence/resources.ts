/*
 * resources.ts
 *
 * Manages all resources needed to create/validate YAML schema, including schemas themselves
 *
 * Copyright (C) 2022 Posit Software, PBC
 */

import { InternalError } from "../error.ts";
import { globToRegExp } from "../glob.ts";

export type YamlIntelligenceResources = Record<string, unknown>;

const _resources: YamlIntelligenceResources = {};
export function setYamlIntelligenceResources(
  resources: YamlIntelligenceResources,
) {
  for (const [key, value] of Object.entries(resources)) {
    _resources[key] = value;
  }
}

export function exportYamlIntelligenceResources(pretty = false): string {
  if (pretty) {
    return JSON.stringify(_resources, null, 2);
  } else {
    return JSON.stringify(_resources);
  }
}

export function getYamlIntelligenceResource(filename: string): unknown {
  if (_resources[filename] === undefined) {
    throw new InternalError(
      `getYamlIntelligenceResource called with missing resource ${filename}`,
    );
  }
  return _resources[filename];
}

export function expandResourceGlob(glob: string): [string, unknown][] {
  return Object.keys(_resources).filter(
    (key) => key.match(globToRegExp(glob)),
  ).map((key) => [key, getYamlIntelligenceResource(key)]);
}
