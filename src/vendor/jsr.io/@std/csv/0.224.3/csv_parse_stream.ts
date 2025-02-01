// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import {
  convertRowToObject,
  defaultReadOptions,
  type LineReader,
  parseRecord,
  type ParseResult,
  type ReadOptions,
} from "./_io.ts";
import { TextDelimiterStream } from "jsr:/@std/streams@^0.224.4/text-delimiter-stream";

/** Options for {@linkcode CsvParseStream}. */
export interface CsvParseStreamOptions extends ReadOptions {
  /**
   * If you provide `skipFirstRow: true` and `columns`, the first line will be
   * skipped.
   * If you provide `skipFirstRow: true` but not `columns`, the first line will
   * be skipped and used as header definitions.
   */
  skipFirstRow?: boolean;
  /** List of names used for header definition. */
  columns?: readonly string[];
}

class StreamLineReader implements LineReader {
  #reader: ReadableStreamDefaultReader<string>;
  #done = false;
  constructor(reader: ReadableStreamDefaultReader<string>) {
    this.#reader = reader;
  }

  async readLine(): Promise<string | null> {
    const { value, done } = await this.#reader.read();
    if (done) {
      this.#done = true;
      return null;
    } else {
      // NOTE: Remove trailing CR for compatibility with golang's `encoding/csv`
      return stripLastCR(value!);
    }
  }

  isEOF(): boolean {
    return this.#done;
  }

  cancel() {
    this.#reader.cancel();
  }
}

function stripLastCR(s: string): string {
  return s.endsWith("\r") ? s.slice(0, -1) : s;
}

/** Row return type. */
export type RowType<T> = T extends undefined ? string[]
  : ParseResult<CsvParseStreamOptions, T>[number];

/**
 * Read data from a CSV-encoded stream or file. Provides an auto/custom mapper
 * for columns.
 *
 * A `CsvParseStream` expects input conforming to
 * {@link https://www.rfc-editor.org/rfc/rfc4180.html | RFC 4180}.
 *
 * @example Usage
 * ```ts no-assert
 * import { CsvParseStream } from "@std/csv/csv-parse-stream";
 *
 * const source = ReadableStream.from([
 *   "name,age",
 *   "Alice,34",
 *   "Bob,24",
 *   "Charlie,45",
 * ]);
 * const parts = source.pipeThrough(new CsvParseStream());
 * ```
 *
 * @typeParam T The type of options for the stream.
 */
export class CsvParseStream<
  const T extends CsvParseStreamOptions | undefined = undefined,
> implements TransformStream<string, RowType<T>> {
  readonly #readable: ReadableStream<
    string[] | Record<string, string | unknown>
  >;
  readonly #options: CsvParseStreamOptions;
  readonly #lineReader: StreamLineReader;
  readonly #lines: TextDelimiterStream;
  #lineIndex = 0;
  #isFirstRow = true;

  #headers: readonly string[] = [];

  /** Construct a new instance.
   *
   * @example Usage
   * ```ts no-assert
   * import { CsvParseStream } from "@std/csv/csv-parse-stream";
   *
   * const source = ReadableStream.from([
   *   "name,age",
   *   "Alice,34",
   *   "Bob,24",
   *   "Charlie,45",
   * ]);
   * const parts = source.pipeThrough(new CsvParseStream());
   * ```
   *
   * @param options Options for the stream.
   */
  constructor(options?: T) {
    this.#options = {
      ...defaultReadOptions,
      ...options,
    };

    this.#lines = new TextDelimiterStream("\n");
    this.#lineReader = new StreamLineReader(this.#lines.readable.getReader());
    this.#readable = new ReadableStream({
      pull: (controller) => this.#pull(controller),
      cancel: () => this.#lineReader.cancel(),
    });
  }

  async #pull(
    controller: ReadableStreamDefaultController<
      string[] | Record<string, string | unknown>
    >,
  ): Promise<void> {
    const line = await this.#lineReader.readLine();
    if (line === "") {
      // Found an empty line
      this.#lineIndex++;
      return this.#pull(controller);
    }
    if (line === null) {
      // Reached to EOF
      controller.close();
      this.#lineReader.cancel();
      return;
    }

    const record = await parseRecord(
      line,
      this.#lineReader,
      this.#options,
      this.#lineIndex,
    );
    if (record === null) {
      controller.close();
      this.#lineReader.cancel();
      return;
    }

    if (this.#isFirstRow) {
      this.#isFirstRow = false;
      if (this.#options.skipFirstRow || this.#options.columns) {
        this.#headers = [];

        if (this.#options.skipFirstRow) {
          const head = record;
          this.#headers = head;
        }

        if (this.#options.columns) {
          this.#headers = this.#options.columns;
        }
      }

      if (this.#options.skipFirstRow) {
        return this.#pull(controller);
      }
    }

    this.#lineIndex++;
    if (record.length > 0) {
      if (this.#options.skipFirstRow || this.#options.columns) {
        controller.enqueue(convertRowToObject(
          record,
          this.#headers,
          this.#lineIndex,
        ));
      } else {
        controller.enqueue(record);
      }
    } else {
      return this.#pull(controller);
    }
  }

  /**
   * The instance's {@linkcode ReadableStream}.
   *
   * @example Usage
   * ```ts no-assert
   * import { CsvParseStream } from "@std/csv/csv-parse-stream";
   *
   * const source = ReadableStream.from([
   *   "name,age",
   *   "Alice,34",
   *   "Bob,24",
   *   "Charlie,45",
   * ]);
   * const parseStream = new CsvParseStream();
   * const parts = source.pipeTo(parseStream.writable);
   * for await (const part of parseStream.readable) {
   *   console.log(part);
   * }
   * ```
   *
   * @returns The instance's {@linkcode ReadableStream}.
   */
  get readable(): ReadableStream<RowType<T>> {
    return this.#readable as ReadableStream<RowType<T>>;
  }

  /**
   * The instance's {@linkcode WritableStream}.
   *
   * @example Usage
   * ```ts no-assert
   * import { CsvParseStream } from "@std/csv/csv-parse-stream";
   *
   * const source = ReadableStream.from([
   *   "name,age",
   *   "Alice,34",
   *   "Bob,24",
   *   "Charlie,45",
   * ]);
   * const parseStream = new CsvParseStream();
   * const parts = source.pipeTo(parseStream.writable);
   * for await (const part of parseStream.readable) {
   *   console.log(part);
   * }
   * ```
   *
   * @returns The instance's {@linkcode WritableStream}.
   */
  get writable(): WritableStream<string> {
    return this.#lines.writable;
  }
}
