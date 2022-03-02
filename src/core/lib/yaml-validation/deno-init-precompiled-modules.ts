/*
* deno-init-precompiled-modules.ts
*
* initializes yaml intelligence using precompiled schemas.
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { initYamlIntelligence } from "../yaml-intelligence/yaml-intelligence.ts";

export async function initPrecompiledModules() {
  await initYamlIntelligence();
}
