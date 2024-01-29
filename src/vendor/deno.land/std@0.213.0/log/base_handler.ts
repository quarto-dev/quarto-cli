// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
import { getLevelByName, LevelName } from "./levels.ts";
import type { LogRecord } from "./logger.ts";

const DEFAULT_FORMATTER = "{levelName} {msg}";
export type FormatterFunction = (logRecord: LogRecord) => string;

export interface BaseHandlerOptions {
  formatter?: string | FormatterFunction;
}

export class BaseHandler {
  level: number;
  levelName: LevelName;
  /**
   * @deprecated (will be removed in 0.213.0) Use {@linkcode FormatterFunction} instead of a string.
   */
  formatter: string | FormatterFunction;

  constructor(levelName: LevelName, options: BaseHandlerOptions = {}) {
    this.level = getLevelByName(levelName);
    this.levelName = levelName;

    this.formatter = options.formatter || DEFAULT_FORMATTER;
  }

  handle(logRecord: LogRecord) {
    if (this.level > logRecord.level) return;

    const msg = this.format(logRecord);
    this.log(msg);
  }

  format(logRecord: LogRecord): string {
    if (this.formatter instanceof Function) {
      return this.formatter(logRecord);
    }

    return this.formatter.replace(/{([^\s}]+)}/g, (match, p1): string => {
      const value = logRecord[p1 as keyof LogRecord];

      // do not interpolate missing values
      if (value === undefined) {
        return match;
      }

      return String(value);
    });
  }

  log(_msg: string) {}
  setup() {}
  destroy() {}

  [Symbol.dispose]() {
    this.destroy();
  }
}
