/*
 * log.ts
 *
 * Copyright (C) 2020-2024 Posit Software, PBC
 */

export {
  debug,
  error,
  getLogger,
  info,
  LogLevels,
  setup,
  warn as warning,
} from "log/mod.ts";

export type { LevelName, LogRecord } from "log/mod.ts";
