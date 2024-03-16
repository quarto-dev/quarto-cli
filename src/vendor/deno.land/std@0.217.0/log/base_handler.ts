// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
import { getLevelByName, LevelName } from "./levels.ts";
import type { LogRecord } from "./logger.ts";

export type FormatterFunction = (logRecord: LogRecord) => string;
const DEFAULT_FORMATTER: FormatterFunction = ({ levelName, msg }) =>
  `${levelName} ${msg}`;

export interface BaseHandlerOptions {
  formatter?: FormatterFunction;
}

export class BaseHandler {
  level: number;
  levelName: LevelName;
  formatter: FormatterFunction;

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
    return this.formatter(logRecord);
  }

  log(_msg: string) {}
  setup() {}
  destroy() {}

  [Symbol.dispose]() {
    this.destroy();
  }
}
