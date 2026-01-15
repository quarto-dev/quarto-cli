/*
 * engine-info.ts
 *
 * Copyright (C) 2022 Posit Software, PBC
 */

import {
  ExecutionEngineInstance,
  ExecutionTarget,
} from "./types.ts";

export function executionEngineCanKeepSource(
  engine: ExecutionEngineInstance,
  target: ExecutionTarget,
) {
  return !engine.canKeepSource || engine.canKeepSource(target);
}
