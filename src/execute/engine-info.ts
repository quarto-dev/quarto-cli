/*
* engine-info.ts
*
* Copyright (C) 2022 Posit Software, PBC
*
*/

import { ExecutionEngine, ExecutionTarget, LaunchedExecutionEngine } from "./types.ts";

export function executionEngineCanKeepSource(
  engine: LaunchedExecutionEngine,
  target: ExecutionTarget,
) {
  return !engine.canKeepSource || engine.canKeepSource(target);
}
