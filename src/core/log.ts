/*
 * log.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { ensureDirSync } from "fs/mod.ts";
import { dirname } from "path/mod.ts";
import * as colors from "fmt/colors.ts";
import * as log from "log/mod.ts";
import { LogRecord } from "log/logger.ts";
import { BaseHandler, FileHandler } from "log/handlers.ts";
import { Command } from "cliffy/command/mod.ts";

import { getenv } from "./env.ts";
import { Args } from "flags/mod.ts";
import { lines } from "./text.ts";
import { debug, error, getLogger, setup, warning } from "log/mod.ts";
import { asErrorEx, InternalError } from "./lib/error.ts";

export type LogLevel = "DEBUG" | "INFO" | "WARNING" | "ERROR";

export interface LogOptions {
  log?: string;
  level?: string;
  format?: "plain" | "json-stream";
  quiet?: boolean;
  newline?: true;
}

export interface LogMessageOptions {
  newline?: boolean;
  bold?: boolean;
  dim?: boolean;
  indent?: number;
  format?: (line: string) => string;
  colorize?: boolean;
}

// deno-lint-ignore no-explicit-any
export function appendLogOptions(cmd: Command<any>): Command<any> {
  return cmd.option(
    "--log <file>",
    "Path to log file",
    {
      global: true,
    },
  ).option(
    "--log-level <level>",
    "Log level (info, warning, error, critical)",
    {
      global: true,
    },
  )
    .option(
      "--log-format <format>",
      "Log format (plain, json-stream)",
      {
        global: true,
      },
    )
    .option(
      "--quiet",
      "Suppress console output.",
      {
        global: true,
      },
    );
}

export function logOptions(args: Args) {
  const logOptions: LogOptions = {};
  logOptions.log = args.l || args.log || Deno.env.get("QUARTO_LOG");
  if (logOptions.log) {
    ensureDirSync(dirname(logOptions.log));
  }
  logOptions.level = args.ll || args["log-level"] ||
    Deno.env.get("QUARTO_LOG_LEVEL");
  logOptions.quiet = args.q || args.quiet;
  logOptions.format = parseFormat(
    args.lf || args["log-format"] || Deno.env.get("QUARTO_LOG_FORMAT"),
  );
  return logOptions;
}

let currentLogLevel: LogLevel = "INFO";
export function logLevel() {
  return currentLogLevel;
}

export class StdErrOutputHandler extends BaseHandler {
  format(logRecord: LogRecord, prefix = true): string {
    // Set default options
    const options = {
      newline: true,
      colorize: true,
      ...(logRecord.args[0] as LogMessageOptions),
    };

    let msg = super.format(logRecord);

    if (prefix && (logRecord.level >= log.LogLevels.WARNING)) {
      msg = `${logRecord.levelName}: ${msg}`;
    }

    // Format the message based upon type
    switch (logRecord.level) {
      case log.LogLevels.INFO:
      case log.LogLevels.DEBUG:
        msg = applyMsgOptions(msg, options);
        break;
      case log.LogLevels.WARNING:
        if (options.colorize) {
          msg = colors.yellow(msg);
        }
        break;
      case log.LogLevels.ERROR:
        if (options.colorize) {
          msg = colors.brightRed(msg);
        }
        break;
      case log.LogLevels.CRITICAL:
        if (options.colorize) {
          msg = colors.bold(colors.red(msg));
        }
        break;
      default:
        break;
    }

    // Apply the new line (it applies across all types)
    if (options.newline) {
      msg = msg + "\n";
    }

    return msg;
  }
  log(msg: string): void {
    Deno.stderr.writeSync(
      new TextEncoder().encode(msg),
    );
  }
}

export class LogEventsHandler extends StdErrOutputHandler {
  constructor(levelName: log.LevelName) {
    super(levelName, {
      formatter: "{msg}",
    });
  }
  handle(logRecord: LogRecord) {
    if (this.level > logRecord.level) return;

    LogEventsHandler.handlers_.forEach((handler) =>
      handler(logRecord, super.format(logRecord, false))
    );
  }

  static onLog(handler: (logRecord: LogRecord, msg: string) => void) {
    LogEventsHandler.handlers_.push(handler);
  }

  private static handlers_ = new Array<
    (logRecord: LogRecord, msg: string) => void
  >();
}

export class LogFileHandler extends FileHandler {
  constructor(levelName: log.LevelName, options: LogFileHandlerOptions) {
    super(levelName, options);
    this.msgFormat = options.format;
  }
  msgFormat;

  format(logRecord: LogRecord): string {
    // Messages that start with a carriage return are progress messages
    // that rewrite a line, so just ignore these
    if (logRecord.msg.startsWith("\r")) {
      return "";
    }

    if (this.msgFormat === undefined || this.msgFormat === "plain") {
      // Implement a plain formatted message which is basically
      // the console output, but written without formatting to the log file
      const options = {
        newline: true,
        ...logRecord.args[0] as LogMessageOptions,
        bold: false,
        dim: false,
        format: undefined,
      };
      let msg = applyMsgOptions(logRecord.msg, options);
      if (options.newline) {
        msg = msg + "\n";
      }

      // Error formatting
      if (logRecord.level >= log.LogLevels.WARNING) {
        return `(${logRecord.levelName}) ${msg}`;
      } else {
        return msg;
      }
    } else {
      // Implement streaming JSON output
      return JSON.stringify(logRecord, undefined, 0) + "\n";
    }
  }

  log(msg: string): void {
    // Ignore any messages that are blank
    if (msg !== "") {
      // Strip any color information that may have been applied
      msg = colors.stripColor(msg);
      this._buf.writeSync(this._encoder.encode(msg));
      this._buf.flush();
    }
  }
}

interface LogFileHandlerOptions {
  filename: string;
  mode?: "a" | "w" | "x";
  format?: "plain" | "json-stream";
}

export async function initializeLogger(logOptions: LogOptions) {
  const handlers: Record<string, BaseHandler> = {};
  const defaultHandlers = [];
  const file = logOptions.log;
  currentLogLevel = logOptions.level ? parseLevel(logOptions.level) : "INFO";

  // Provide a stream of log events
  handlers["events"] = new LogEventsHandler(logLevel());
  defaultHandlers.push("events");

  // Don't add the StdErroutputHandler if we're quiet
  if (!logOptions.quiet) {
    // Default logger just redirects to the console
    handlers["console"] = new StdErrOutputHandler(
      logLevel(),
      {
        formatter: "{msg}",
      },
    );
    defaultHandlers.push("console");
  }

  // If a file is specified, add a file based logger
  if (file) {
    handlers["file"] = new LogFileHandler(
      logLevel(),
      {
        filename: file,
        mode: "w",
        format: logOptions.format,
      },
    );
    defaultHandlers.push("file");
  }

  // Setup the loggers
  await setup({
    handlers,
    loggers: {
      default: {
        level: "DEBUG",
        handlers: defaultHandlers,
      },
    },
  });
}

export async function cleanupLogger() {
  // Destroy each of the handlers when we exit
  const logger = getLogger();
  for (const handler of logger.handlers) {
    await handler.destroy();
  }

  // Clear the handlers
  logger.handlers = [];
}

export function logProgress(message: string) {
  log.info(colors.bold(colors.blue(message)));
}

export function logError(e: unknown) {
  // normalize
  const err = asErrorEx(e);

  // print error name if requested
  let message = err.printName ? `${err.name}: ${err.message}` : err.message;

  if (e instanceof InternalError) {
    // always print stack information of internal errors
    message = message +
      `\n\nThis is a bug in quarto. We apologize for the inconvenience.
Please consider reporting it at https://github.com/quarto-dev/quarto-cli. Thank you!`;
  }

  // print the stack if requested or if this is a debug build
  const isDebug = getenv("QUARTO_DEBUG", "false") === "true" ||
    getenv("QUARTO_PRINT_STACK", "false") === "true";
  if (err.stack && (isDebug || err.printStack)) {
    if (!message) {
      message = err.stack;
    } else {
      message = message + "\n\nStack trace:\n" +
        err.stack.split("\n").slice(1).join("\n");
    }
  }

  // show message if we have one
  if (message) {
    error(message);
  }
}

export function errorOnce(msg: string) {
  if (!errors[msg]) {
    errors[msg] = true;
    error(msg);
    return true;
  }
  return false;
}
const errors: Record<string, boolean> = {};

export function warnOnce(msg: string) {
  if (!warnings[msg]) {
    warnings[msg] = true;
    warning(msg);
  }
}
const warnings: Record<string, boolean> = {};

export function debugOnce(msg: string) {
  if (!debugs[msg]) {
    debugs[msg] = true;
    debug(msg);
  }
}
const debugs: Record<string, boolean> = {};

function applyMsgOptions(msg: string, options: LogMessageOptions) {
  if (options.indent) {
    const pad = " ".repeat(options.indent);
    msg = lines(msg)
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

  return msg;
}

function parseFormat(format?: string) {
  if (format) {
    format = format.toLowerCase();
    switch (format) {
      case "plain":
      case "json-stream":
        return format;
      default:
        return "plain";
    }
  } else {
    return "plain";
  }
}

function parseLevel(
  level: string,
): LogLevel {
  const lvl = levelMap[level.toLowerCase()];
  if (lvl) {
    return lvl;
  } else {
    return "WARNING";
  }
}
const levelMap: Record<
  string,
  LogLevel
> = {
  debug: "DEBUG",
  info: "INFO",
  warning: "WARNING",
  error: "ERROR",
};
