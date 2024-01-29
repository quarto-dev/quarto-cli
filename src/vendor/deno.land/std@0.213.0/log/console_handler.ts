// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
import { LevelName, LogLevels } from "./levels.ts";
import type { LogRecord } from "./logger.ts";
import { blue, bold, red, yellow } from "../fmt/colors.ts";
import { BaseHandler, type BaseHandlerOptions } from "./base_handler.ts";

export interface ConsoleHandlerOptions extends BaseHandlerOptions {
  useColors?: boolean;
}

/**
 * This is the default logger. It will output color coded log messages to the
 * console via `console.log()`.
 */
export class ConsoleHandler extends BaseHandler {
  #useColors?: boolean;

  constructor(levelName: LevelName, options: ConsoleHandlerOptions = {}) {
    super(levelName, options);
    this.#useColors = options.useColors ?? true;
  }

  override format(logRecord: LogRecord): string {
    let msg = super.format(logRecord);

    if (this.#useColors) {
      msg = this.applyColors(msg, logRecord.level);
    }

    return msg;
  }

  applyColors(msg: string, level: number): string {
    switch (level) {
      case LogLevels.INFO:
        msg = blue(msg);
        break;
      case LogLevels.WARNING:
        msg = yellow(msg);
        break;
      case LogLevels.ERROR:
        msg = red(msg);
        break;
      case LogLevels.CRITICAL:
        msg = bold(red(msg));
        break;
      default:
        break;
    }

    return msg;
  }

  override log(msg: string) {
    console.log(msg);
  }
}
