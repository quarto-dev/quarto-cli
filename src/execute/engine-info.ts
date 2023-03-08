/*
* engine-info.ts
*
* Copyright (C) 2022-2023 Posit, PBC
*
*/

import { ExecutionEngine, ExecutionTarget } from "./types.ts";

export function executionEngineCanKeepSource(
  engine: ExecutionEngine,
  target: ExecutionTarget,
) {
  return !engine.canKeepSource || engine.canKeepSource(target);
}
