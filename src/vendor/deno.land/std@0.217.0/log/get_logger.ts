// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

import { assert } from "../assert/assert.ts";
import { Logger } from "./logger.ts";
import { state } from "./_state.ts";

/** Get a logger instance. If not specified `name`, get the default logger. */
export function getLogger(name?: string): Logger {
  if (!name) {
    const d = state.loggers.get("default");
    assert(
      d !== undefined,
      `"default" logger must be set for getting logger without name`,
    );
    return d;
  }
  const result = state.loggers.get(name);
  if (!result) {
    const logger = new Logger(name, "NOTSET", { handlers: [] });
    state.loggers.set(name, logger);
    return logger;
  }
  return result;
}
