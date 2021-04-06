/*
* log.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { getenv } from "./env.ts";
import * as log from "log/mod.ts";
import { BaseHandler } from "log/handlers.ts";
import { Logger } from "log/mod.ts";

export interface LogOptions {
  log?: string;
  level?: string;
  format?: string;
  quiet?: boolean;
}
export async function initializeLogger(logOptions: LogOptions) {
  const isDebug = getenv("QUARTO_DEBUG", "false") === "true";

  const handlers: Record<string, BaseHandler> = {};
  const defaultHandlers = [];
  const file = logOptions.log;
  const level = logOptions.level || isDebug ? "debug" : "warning";

  if (!logOptions.quiet) {
    // Default logger just redirects to the console
    handlers["console"] = new log.handlers.ConsoleHandler(
      isDebug ? "DEBUG" : "INFO",
      {
        formatter: "{levelName}: {msg}",
      },
    );
    defaultHandlers.push("console");

    // If a file is specified, use a file based logger
    if (file) {
      handlers["file"] = new log.handlers.FileHandler(parseLevel(level), {
        filename: file,
        formatter: "{datetime} {levelName}: {msg}",
      });
      defaultHandlers.push("file");
    }
  }

  // Setup the logger
  await log.setup({
    handlers,
    loggers: {
      default: {
        level: "DEBUG",
        handlers: defaultHandlers,
      },
    },
  });
}

export function cleanupLogger() {
}

export function logError(error: Error) {
  const isDebug = getenv("QUARTO_DEBUG", "false") === "true";
  if (isDebug) {
    log.error(error.stack);
  } else {
    log.error(`${error.name}: ${error.message}`);
  }
}

function parseLevel(
  level: string,
): "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL" {
  const lvl = levelMap[level.toLowerCase()];
  if (lvl) {
    return lvl;
  } else {
    return "WARNING";
  }
}
const levelMap: Record<
  string,
  "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL"
> = {
  debug: "DEBUG",
  info: "INFO",
  warning: "WARNING",
  error: "ERROR",
  critical: "CRITICAL",
};
