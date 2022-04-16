/*
* engine-info.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { ExecutionEngine, ExecutionTarget } from "./types.ts";

export function executionEngineCanKeepSource(
  engine: ExecutionEngine,
  target: ExecutionTarget,
) {
  return !engine.canKeepSource || engine.canKeepSource(target);
}
