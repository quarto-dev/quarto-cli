// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
import { LevelName, LogLevels } from "./levels.ts";
import type { LogRecord } from "./logger.ts";
import { BaseHandler, type BaseHandlerOptions } from "./base_handler.ts";

const PAGE_SIZE = 4096;
export type LogMode = "a" | "w" | "x";

export interface FileHandlerOptions extends BaseHandlerOptions {
  filename: string;
  mode?: LogMode;
}

/**
 * This handler will output to a file using an optional mode (default is `a`,
 * e.g. append). The file will grow indefinitely. It uses a buffer for writing
 * to file. Logs can be manually flushed with `fileHandler.flush()`. Log
 * messages with a log level greater than error are immediately flushed. Logs
 * are also flushed on process completion.
 *
 * Behavior of the log modes is as follows:
 *
 * - `'a'` - Default mode. Appends new log messages to the end of an existing log
 *   file, or create a new log file if none exists.
 * - `'w'` - Upon creation of the handler, any existing log file will be removed
 *   and a new one created.
 * - `'x'` - This will create a new log file and throw an error if one already
 *   exists.
 *
 * This handler requires `--allow-write` permission on the log file.
 */
export class FileHandler extends BaseHandler {
  protected _file: Deno.FsFile | undefined;
  protected _buf: Uint8Array = new Uint8Array(PAGE_SIZE);
  protected _pointer = 0;
  protected _filename: string;
  protected _mode: LogMode;
  protected _openOptions: Deno.OpenOptions;
  protected _encoder: TextEncoder = new TextEncoder();
  #unloadCallback = (() => {
    this.destroy();
  }).bind(this);

  constructor(levelName: LevelName, options: FileHandlerOptions) {
    super(levelName, options);
    this._filename = options.filename;
    // default to append mode, write only
    this._mode = options.mode ? options.mode : "a";
    this._openOptions = {
      createNew: this._mode === "x",
      create: this._mode !== "x",
      append: this._mode === "a",
      truncate: this._mode !== "a",
      write: true,
    };
  }

  override setup() {
    this._file = Deno.openSync(this._filename, this._openOptions);
    this.#resetBuffer();

    addEventListener("unload", this.#unloadCallback);
  }

  override handle(logRecord: LogRecord) {
    super.handle(logRecord);

    // Immediately flush if log level is higher than ERROR
    if (logRecord.level > LogLevels.ERROR) {
      this.flush();
    }
  }

  override log(msg: string) {
    const bytes = this._encoder.encode(msg + "\n");
    if (bytes.byteLength > this._buf.byteLength - this._pointer) {
      this.flush();
    }
    this._buf.set(bytes, this._pointer);
    this._pointer += bytes.byteLength;
  }

  flush() {
    if (this._pointer > 0 && this._file) {
      let written = 0;
      while (written < this._pointer) {
        written += this._file.writeSync(
          this._buf.subarray(written, this._pointer),
        );
      }
      this.#resetBuffer();
    }
  }

  #resetBuffer() {
    this._pointer = 0;
  }

  override destroy() {
    this.flush();
    this._file?.close();
    this._file = undefined;
    removeEventListener("unload", this.#unloadCallback);
  }
}
