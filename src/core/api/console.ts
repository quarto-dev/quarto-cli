// src/core/api/console.ts

import { globalRegistry } from "./registry.ts";
import type { ConsoleNamespace } from "./types.ts";

// Import implementations
import { completeMessage, withSpinner } from "../console.ts";
import * as log from "../../deno_ral/log.ts";
import type { LogMessageOptions } from "../log.ts";

// Register console namespace
globalRegistry.register("console", (): ConsoleNamespace => {
  return {
    withSpinner,
    completeMessage,
    info: (message: string, options?: LogMessageOptions) =>
      log.info(message, options),
    warning: (message: string, options?: LogMessageOptions) =>
      log.warning(message, options),
    error: (message: string, options?: LogMessageOptions) =>
      log.error(message, options),
  };
});
