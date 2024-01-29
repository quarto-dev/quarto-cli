// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
import { LogRecord } from "./logger.ts";

export function jsonFormatter(logRecord: LogRecord): string {
  return JSON.stringify({
    level: logRecord.levelName,
    datetime: logRecord.datetime.getTime(),
    message: logRecord.msg,
    args: flattenArgs(logRecord.args),
  });
}

function flattenArgs(args: unknown[]): unknown {
  if (args.length === 1) {
    return args[0];
  } else if (args.length > 1) {
    return args;
  }
}
