/*
* log.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import * as colors from "fmt/colors.ts";
import * as log from "log/mod.ts";
import { LogRecord } from "log/logger.ts";
import { BaseHandler, FileHandler } from "log/handlers.ts";

import { getenv } from "./env.ts";

export interface LogOptions {
  log?: string;
  level?: string;
  format?: string;
  quiet?: boolean;
  newline?: true;
}

export interface LogMessageOptions {
  newline?: boolean;
  bold?: boolean;
  dim?: boolean;
  indent?: number;
  format?: (line: string) => string;
}

function formatMsg(msg: string, options: LogMessageOptions) {
  if (options.indent) {
    const pad = " ".repeat(options.indent);
    msg = msg
      .split(/\r?\n/)
      .map((msg) => pad + msg)
      .join("\n");
  }
  if (options.bold) {
    msg = colors.bold(msg);
  }
  if (options.dim) {
    msg = colors.dim(msg);
  }
  if (options.format) {
    msg = options.format(msg);
  }

  if (options.newline) {
    msg = msg + "\n";
  }

  return msg;
}

export class MessageHandler extends BaseHandler {
  format(logRecord: LogRecord): string {
    let msg = super.format(logRecord);
    const options = {
      newline: true,
      ...(logRecord.args[0] as LogMessageOptions),
    };

    switch (logRecord.level) {
      case log.LogLevels.INFO:
      case log.LogLevels.DEBUG:
        msg = formatMsg(msg, options);
        break;
      case log.LogLevels.WARNING:
        msg = colors.yellow(msg);
        break;
      case log.LogLevels.ERROR:
        msg = colors.red(msg);
        break;
      case log.LogLevels.CRITICAL:
        msg = colors.bold(colors.red(msg));
        break;
      default:
        break;
    }

    return msg;
  }
  log(msg: string): void {
    Deno.stderr.writeSync(
      new TextEncoder().encode(msg),
    );
  }
}

export class LogFileHandler extends FileHandler {
  format(logRecord: LogRecord): string {
    const options = {
      newline: true,
      ...logRecord.args[0] as LogMessageOptions,
      bold: false,
      dim: false,
      format: undefined,
    };
    const msg = formatMsg(logRecord.msg, options);
    return msg;
  }

  log(msg: string): void {
    if (!msg.startsWith("\r")) {
      msg = colors.stripColor(msg);
      this._buf.writeSync(this._encoder.encode(msg + "\n"));
    }
  }
}

export async function initializeLogger(logOptions: LogOptions) {
  const isDebug = getenv("QUARTO_DEBUG", "false") === "true";

  const handlers: Record<string, BaseHandler> = {};
  const defaultHandlers = [];
  const file = logOptions.log;
  const level = logOptions.level || isDebug ? "debug" : "warning";

  if (!logOptions.quiet) {
    // Default logger just redirects to the console
    handlers["console"] = new MessageHandler(
      isDebug ? "DEBUG" : "INFO",
      {
        formatter: "{msg}",
      },
    );
    defaultHandlers.push("console");
  }

  // If a file is specified, use a file based logger
  if (file) {
    handlers["file"] = new LogFileHandler(parseLevel(level), {
      filename: file,
      mode: "w",
    });
    defaultHandlers.push("file");
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

export function logInfo(msg: string) {
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
