/*
 * log.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { ensureDirSync } from "../deno_ral/fs.ts";
import { dirname } from "../deno_ral/path.ts";
import * as colors from "fmt/colors";
import * as log from "../deno_ral/log.ts";
import { LogRecord } from "log/logger";
import { BaseHandler } from "log/base-handler";
import { FileHandler } from "log/file-handler";
import { Command } from "cliffy/command/mod.ts";

import { getenv } from "./env.ts";
import { Args } from "flags";
import { lines } from "./text.ts";
import { debug, error, getLogger, setup, warning } from "../deno_ral/log.ts";
import { asErrorEx, InternalError } from "./lib/error.ts";
import { onCleanup } from "./cleanup.ts";
import { execProcess } from "./process.ts";
import { pandocBinaryPath } from "./resources.ts";
import { Block, pandoc } from "./pandoc/json.ts";

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

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
  stripAnsiCode?: boolean;
}

// deno-lint-ignore no-explicit-any
export function appendLogOptions(cmd: Command<any>): Command<any> {
  // deno-lint-ignore no-explicit-any
  const addLogOptions = (cmd: Command<any>) => {
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
  };

  // If there are subcommands, forward the log options
  // directly to the subcommands. Otherwise, just attach
  // to the outer command
  //
  // Fixes https://github.com/quarto-dev/quarto-cli/issues/8438
  const subCommands = cmd.getCommands();
  if (subCommands.length > 0) {
    subCommands.forEach((command) => {
      addLogOptions(command);
    });
    return cmd;
  } else {
    return addLogOptions(cmd);
  }
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
  override format(logRecord: LogRecord, prefix = true): string {
    // Set default options
    const options = {
      newline: true,
      colorize: true,
      ...(logRecord.args[0] as LogMessageOptions),
    };

    let msg = super.format(logRecord);

    if (prefix && (logRecord.level >= log.LogLevels.WARN)) {
      msg = `${logRecord.levelName}: ${msg}`;
    }

    // Format the message based upon type
    switch (logRecord.level) {
      case log.LogLevels.INFO:
      case log.LogLevels.DEBUG:
        msg = applyMsgOptions(msg, options);
        break;
      case log.LogLevels.WARN:
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
  override log(msg: string): void {
    const encoder = new TextEncoder();
    const data = encoder.encode(msg);

    let bytesWritten = 0;
    while (bytesWritten < data.length) {
      // Write the remaining portion of the buffer
      const remaining = data.subarray(bytesWritten);
      const written = Deno.stderr.writeSync(remaining);

      // If we wrote 0 bytes, something is wrong - avoid infinite loop
      if (written === 0) {
        // Could add fallback handling here if needed
        break;
      }

      bytesWritten += written;
    }
  }
}

export class LogEventsHandler extends StdErrOutputHandler {
  constructor(levelName: log.LevelName) {
    super(levelName, {
      formatter: (({ msg }) => `${msg}`),
    });
  }
  override handle(logRecord: LogRecord) {
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
  logger: FileHandler;
  constructor(levelName: log.LevelName, options: LogFileHandlerOptions) {
    super(levelName, options);
    this.logger = new FileHandler(levelName, options);
    this.logger.setup();
    this.msgFormat = options.format;
    this.logger.formatter = this.format.bind(this);
  }
  msgFormat;

  override flush(): void {
    this.logger.flush();
  }

  override format(logRecord: LogRecord): string {
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
        stripAnsiCode: true,
        format: undefined,
      };
      let msg = applyMsgOptions(logRecord.msg, options);
      if (options.newline) {
        msg = msg + "\n";
      }

      // Error formatting
      if (logRecord.level >= log.LogLevels.WARN) {
        return `(${logRecord.levelName}) ${msg}`;
      } else {
        return msg;
      }
    } else {
      // Implement streaming JSON output
      return JSON.stringify(logRecord, undefined, 0) + "\n";
    }
  }

  override async log(msg: string) {
    // Ignore any messages that are blank
    if (msg !== "") {
      this.logger.log(msg);
      this.flush();
    }
  }
}

interface LogFileHandlerOptions {
  filename: string;
  mode?: "a" | "w" | "x";
  format?: "plain" | "json-stream";
}

export function flushLoggers(handlers: Record<string, BaseHandler>) {
  if (handlers["file"]) {
    (handlers["file"] as LogFileHandler).flush();
  }
}

export async function initializeLogger(
  logOptions: LogOptions,
): Promise<Record<string, BaseHandler>> {
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
        formatter: (({ msg }) => `${msg}`),
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

  onCleanup(cleanupLogger);

  return handlers;
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

export function logError(e: unknown, defaultShowStack = true) {
  // normalize
  const err = asErrorEx(e, defaultShowStack);

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
      const stackLines = err.stack.split("\n");
      const firstAtLineIndex = stackLines.findIndex((line) =>
        /^\s*at /.test(line)
      );
      if (firstAtLineIndex !== -1) {
        const stackTrace = stackLines.slice(firstAtLineIndex).join("\n");
        message = message + "\n\nStack trace:\n" + stackTrace;
      }
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
  if (options.stripAnsiCode) {
    msg = colors.stripAnsiCode(msg);
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
    return "WARN";
  }
}
const levelMap: Record<
  string,
  LogLevel
> = {
  debug: "DEBUG",
  info: "INFO",
  warning: "WARN",
  error: "ERROR",
};

export async function logPandocJson(
  blocks: Block[],
) {
  const src = JSON.stringify(pandoc({}, blocks), null, 2);
  return logPandoc(src, "json");
}

const getColumns = () => {
  try {
    // Catch error in none tty mode: Inappropriate ioctl for device (os error 25)
    return Deno.consoleSize().columns ?? 130;
  } catch (_error) {
    return 130;
  }
};

export async function logPandoc(
  src: string,
  format: string = "markdown",
) {
  const cols = getColumns();
  const result = await execProcess({
    cmd: pandocBinaryPath(),
    args: [
      "-f",
      format,
      "-t",
      "ansi",
      `--columns=${cols}`,
    ],
    stdout: "piped",
  }, src);
  if (result.code !== 0) {
    error(result.stderr);
  } else {
    log.info(result.stdout);
  }
}
