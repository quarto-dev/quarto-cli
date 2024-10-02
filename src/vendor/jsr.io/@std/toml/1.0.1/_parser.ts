// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { deepMerge } from "jsr:@std/collections@^1.0.5/deep-merge";

// ---------------------------
// Interfaces and base classes
// ---------------------------

interface Success<T> {
  ok: true;
  body: T;
}
interface Failure {
  ok: false;
}
type ParseResult<T> = Success<T> | Failure;

type ParserComponent<T = unknown> = (scanner: Scanner) => ParseResult<T>;

type BlockParseResultBody = {
  type: "Block";
  value: Record<string, unknown>;
} | {
  type: "Table";
  key: string[];
  value: Record<string, unknown>;
} | {
  type: "TableArray";
  key: string[];
  value: Record<string, unknown>;
};

export class Scanner {
  #whitespace = /[ \t]/;
  #position = 0;
  #source: string;

  constructor(source: string) {
    this.#source = source;
  }

  /**
   * Get current character
   * @param index - relative index from current position
   */
  char(index = 0) {
    return this.#source[this.#position + index] ?? "";
  }

  /**
   * Get sliced string
   * @param start - start position relative from current position
   * @param end - end position relative from current position
   */
  slice(start: number, end: number): string {
    return this.#source.slice(this.#position + start, this.#position + end);
  }

  /**
   * Move position to next
   */
  next(count?: number) {
    if (typeof count === "number") {
      for (let i = 0; i < count; i++) {
        this.#position++;
      }
    } else {
      this.#position++;
    }
  }

  /**
   * Move position until current char is not a whitespace, EOL, or comment.
   * @param options.inline - skip only whitespaces
   */
  nextUntilChar(
    options: { inline?: boolean; comment?: boolean } = { comment: true },
  ) {
    if (options.inline) {
      while (this.#whitespace.test(this.char()) && !this.eof()) {
        this.next();
      }
    } else {
      while (!this.eof()) {
        const char = this.char();
        if (this.#whitespace.test(char) || this.isCurrentCharEOL()) {
          this.next();
        } else if (options.comment && this.char() === "#") {
          // entering comment
          while (!this.isCurrentCharEOL() && !this.eof()) {
            this.next();
          }
        } else {
          break;
        }
      }
    }
    // Invalid if current char is other kinds of whitespace
    if (!this.isCurrentCharEOL() && /\s/.test(this.char())) {
      const escaped = "\\u" + this.char().charCodeAt(0).toString(16);
      const position = this.#position;
      throw new SyntaxError(
        `Cannot parse the TOML: It contains invalid whitespace at position '${position}': \`${escaped}\``,
      );
    }
  }

  /**
   * Position reached EOF or not
   */
  eof() {
    return this.position() >= this.#source.length;
  }

  /**
   * Get current position
   */
  position() {
    return this.#position;
  }

  isCurrentCharEOL() {
    return this.char() === "\n" || this.slice(0, 2) === "\r\n";
  }
}

// -----------------------
// Utilities
// -----------------------

function success<T>(body: T): Success<T> {
  return { ok: true, body };
}
function failure(): Failure {
  return { ok: false };
}

export function unflat(
  keys: string[],
  values: unknown = {},
  cObj?: unknown,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (keys.length === 0) {
    return cObj as Record<string, unknown>;
  }
  if (!cObj) cObj = values;
  const key: string | undefined = keys[keys.length - 1];
  if (typeof key === "string") out[key] = cObj;
  return unflat(keys.slice(0, -1), values, out);
}
export function deepAssignWithTable(target: Record<string, unknown>, table: {
  type: "Table" | "TableArray";
  key: string[];
  value: Record<string, unknown>;
}) {
  if (table.key.length === 0 || table.key[0] == null) {
    throw new Error(
      "Cannot parse the TOML: key length is not a positive number",
    );
  }
  const value = target[table.key[0]];

  if (typeof value === "undefined") {
    Object.assign(
      target,
      unflat(
        table.key,
        table.type === "Table" ? table.value : [table.value],
      ),
    );
  } else if (Array.isArray(value)) {
    if (table.type === "TableArray" && table.key.length === 1) {
      value.push(table.value);
    } else {
      const last = value[value.length - 1];
      deepAssignWithTable(last, {
        type: table.type,
        key: table.key.slice(1),
        value: table.value,
      });
    }
  } else if (typeof value === "object" && value !== null) {
    deepAssignWithTable(value as Record<string, unknown>, {
      type: table.type,
      key: table.key.slice(1),
      value: table.value,
    });
  } else {
    throw new Error("Unexpected assign");
  }
}

// ---------------------------------
// Parser combinators and generators
// ---------------------------------

function or<T>(parsers: ParserComponent<T>[]): ParserComponent<T> {
  return (scanner: Scanner): ParseResult<T> => {
    for (const parse of parsers) {
      const result = parse(scanner);
      if (result.ok) return result;
    }
    return failure();
  };
}

function join<T>(
  parser: ParserComponent<T>,
  separator: string,
): ParserComponent<T[]> {
  const Separator = character(separator);
  return (scanner: Scanner): ParseResult<T[]> => {
    const first = parser(scanner);
    if (!first.ok) return failure();
    const out: T[] = [first.body];
    while (!scanner.eof()) {
      if (!Separator(scanner).ok) break;
      const result = parser(scanner);
      if (!result.ok) {
        throw new SyntaxError(`Invalid token after "${separator}"`);
      }
      out.push(result.body);
    }
    return success(out);
  };
}

function kv<T>(
  keyParser: ParserComponent<string[]>,
  separator: string,
  valueParser: ParserComponent<T>,
): ParserComponent<{ [key: string]: unknown }> {
  const Separator = character(separator);
  return (scanner: Scanner): ParseResult<{ [key: string]: unknown }> => {
    const key = keyParser(scanner);
    if (!key.ok) return failure();
    const sep = Separator(scanner);
    if (!sep.ok) {
      throw new SyntaxError(`key/value pair doesn't have "${separator}"`);
    }
    const value = valueParser(scanner);
    if (!value.ok) {
      throw new SyntaxError(
        `Value of key/value pair is invalid data format`,
      );
    }
    return success(unflat(key.body, value.body));
  };
}

function merge(
  parser: ParserComponent<unknown[]>,
): ParserComponent<Record<string, unknown>> {
  return (scanner: Scanner): ParseResult<Record<string, unknown>> => {
    const result = parser(scanner);
    if (!result.ok) return failure();
    let body = {};
    for (const record of result.body) {
      if (typeof body === "object" && body !== null) {
        // deno-lint-ignore no-explicit-any
        body = deepMerge(body, record as Record<any, any>);
      }
    }
    return success(body);
  };
}

function repeat<T>(
  parser: ParserComponent<T>,
): ParserComponent<T[]> {
  return (scanner: Scanner) => {
    const body: T[] = [];
    while (!scanner.eof()) {
      const result = parser(scanner);
      if (!result.ok) break;
      body.push(result.body);
      scanner.nextUntilChar();
    }
    if (body.length === 0) return failure();
    return success(body);
  };
}

function surround<T>(
  left: string,
  parser: ParserComponent<T>,
  right: string,
): ParserComponent<T> {
  const Left = character(left);
  const Right = character(right);
  return (scanner: Scanner) => {
    if (!Left(scanner).ok) {
      return failure();
    }
    const result = parser(scanner);
    if (!result.ok) {
      throw new SyntaxError(`Invalid token after "${left}"`);
    }
    if (!Right(scanner).ok) {
      throw new SyntaxError(
        `Not closed by "${right}" after started with "${left}"`,
      );
    }
    return success(result.body);
  };
}

function character(str: string) {
  return (scanner: Scanner): ParseResult<void> => {
    scanner.nextUntilChar({ inline: true });
    if (scanner.slice(0, str.length) !== str) return failure();
    scanner.next(str.length);
    scanner.nextUntilChar({ inline: true });
    return success(undefined);
  };
}

// -----------------------
// Parser components
// -----------------------

const BARE_KEY_REGEXP = /[A-Za-z0-9_-]/;
const FLOAT_REGEXP = /[0-9_\.e+\-]/i;
const END_OF_VALUE_REGEXP = /[ \t\r\n#,}\]]/;

export function bareKey(scanner: Scanner): ParseResult<string> {
  scanner.nextUntilChar({ inline: true });
  if (!scanner.char() || !BARE_KEY_REGEXP.test(scanner.char())) {
    return failure();
  }
  const acc: string[] = [];
  while (scanner.char() && BARE_KEY_REGEXP.test(scanner.char())) {
    acc.push(scanner.char());
    scanner.next();
  }
  const key = acc.join("");
  return success(key);
}

function escapeSequence(scanner: Scanner): ParseResult<string> {
  if (scanner.char() !== "\\") return failure();
  scanner.next();
  // See https://toml.io/en/v1.0.0-rc.3#string
  switch (scanner.char()) {
    case "b":
      scanner.next();
      return success("\b");
    case "t":
      scanner.next();
      return success("\t");
    case "n":
      scanner.next();
      return success("\n");
    case "f":
      scanner.next();
      return success("\f");
    case "r":
      scanner.next();
      return success("\r");
    case "u":
    case "U": {
      // Unicode character
      const codePointLen = scanner.char() === "u" ? 4 : 6;
      const codePoint = parseInt(
        "0x" + scanner.slice(1, 1 + codePointLen),
        16,
      );
      const str = String.fromCodePoint(codePoint);
      scanner.next(codePointLen + 1);
      return success(str);
    }
    case '"':
      scanner.next();
      return success('"');
    case "\\":
      scanner.next();
      return success("\\");
    default:
      throw new SyntaxError(
        `Invalid escape sequence: \\${scanner.char()}`,
      );
  }
}

export function basicString(scanner: Scanner): ParseResult<string> {
  scanner.nextUntilChar({ inline: true });
  if (scanner.char() !== '"') return failure();
  scanner.next();
  const acc = [];
  while (scanner.char() !== '"' && !scanner.eof()) {
    if (scanner.char() === "\n") {
      throw new SyntaxError("Single-line string cannot contain EOL");
    }
    const escapedChar = escapeSequence(scanner);
    if (escapedChar.ok) {
      acc.push(escapedChar.body);
    } else {
      acc.push(scanner.char());
      scanner.next();
    }
  }
  if (scanner.eof()) {
    throw new SyntaxError(
      `Single-line string is not closed:\n${acc.join("")}`,
    );
  }
  scanner.next(); // skip last '""
  return success(acc.join(""));
}

export function literalString(scanner: Scanner): ParseResult<string> {
  scanner.nextUntilChar({ inline: true });
  if (scanner.char() !== "'") return failure();
  scanner.next();
  const acc: string[] = [];
  while (scanner.char() !== "'" && !scanner.eof()) {
    if (scanner.char() === "\n") {
      throw new SyntaxError("Single-line string cannot contain EOL");
    }
    acc.push(scanner.char());
    scanner.next();
  }
  if (scanner.eof()) {
    throw new SyntaxError(
      `Single-line string is not closed:\n${acc.join("")}`,
    );
  }
  scanner.next(); // skip last "'"
  return success(acc.join(""));
}

export function multilineBasicString(
  scanner: Scanner,
): ParseResult<string> {
  scanner.nextUntilChar({ inline: true });
  if (scanner.slice(0, 3) !== '"""') return failure();
  scanner.next(3);
  if (scanner.char() === "\n") {
    // The first newline (LF) is trimmed
    scanner.next();
  } else if (scanner.slice(0, 2) === "\r\n") {
    // The first newline (CRLF) is trimmed
    scanner.next(2);
  }
  const acc: string[] = [];
  while (scanner.slice(0, 3) !== '"""' && !scanner.eof()) {
    // line ending backslash
    if (scanner.slice(0, 2) === "\\\n") {
      scanner.next();
      scanner.nextUntilChar({ comment: false });
      continue;
    } else if (scanner.slice(0, 3) === "\\\r\n") {
      scanner.next();
      scanner.nextUntilChar({ comment: false });
      continue;
    }
    const escapedChar = escapeSequence(scanner);
    if (escapedChar.ok) {
      acc.push(escapedChar.body);
    } else {
      acc.push(scanner.char());
      scanner.next();
    }
  }

  if (scanner.eof()) {
    throw new SyntaxError(
      `Multi-line string is not closed:\n${acc.join("")}`,
    );
  }
  // if ends with 4 `"`, push the fist `"` to string
  if (scanner.char(3) === '"') {
    acc.push('"');
    scanner.next();
  }
  scanner.next(3); // skip last '""""
  return success(acc.join(""));
}

export function multilineLiteralString(
  scanner: Scanner,
): ParseResult<string> {
  scanner.nextUntilChar({ inline: true });
  if (scanner.slice(0, 3) !== "'''") return failure();
  scanner.next(3);
  if (scanner.char() === "\n") {
    // The first newline (LF) is trimmed
    scanner.next();
  } else if (scanner.slice(0, 2) === "\r\n") {
    // The first newline (CRLF) is trimmed
    scanner.next(2);
  }
  const acc: string[] = [];
  while (scanner.slice(0, 3) !== "'''" && !scanner.eof()) {
    acc.push(scanner.char());
    scanner.next();
  }
  if (scanner.eof()) {
    throw new SyntaxError(
      `Multi-line string is not closed:\n${acc.join("")}`,
    );
  }
  // if ends with 4 `'`, push the fist `'` to string
  if (scanner.char(3) === "'") {
    acc.push("'");
    scanner.next();
  }
  scanner.next(3); // skip last "'''"
  return success(acc.join(""));
}

const symbolPairs: [string, unknown][] = [
  ["true", true],
  ["false", false],
  ["inf", Infinity],
  ["+inf", Infinity],
  ["-inf", -Infinity],
  ["nan", NaN],
  ["+nan", NaN],
  ["-nan", NaN],
];
export function symbols(scanner: Scanner): ParseResult<unknown> {
  scanner.nextUntilChar({ inline: true });
  const found = symbolPairs.find(([str]) =>
    scanner.slice(0, str.length) === str
  );
  if (!found) return failure();
  const [str, value] = found;
  scanner.next(str.length);
  return success(value);
}

export const dottedKey = join(or([bareKey, basicString, literalString]), ".");

export function integer(scanner: Scanner): ParseResult<number | string> {
  scanner.nextUntilChar({ inline: true });

  // If binary / octal / hex
  const first2 = scanner.slice(0, 2);
  if (first2.length === 2 && /0(?:x|o|b)/i.test(first2)) {
    scanner.next(2);
    const acc = [first2];
    while (/[0-9a-f_]/i.test(scanner.char()) && !scanner.eof()) {
      acc.push(scanner.char());
      scanner.next();
    }
    if (acc.length === 1) return failure();
    return success(acc.join(""));
  }

  const acc = [];
  if (/[+-]/.test(scanner.char())) {
    acc.push(scanner.char());
    scanner.next();
  }
  while (/[0-9_]/.test(scanner.char()) && !scanner.eof()) {
    acc.push(scanner.char());
    scanner.next();
  }

  if (acc.length === 0 || (acc.length === 1 && /[+-]/.test(acc[0]!))) {
    return failure();
  }

  const int = parseInt(acc.filter((char) => char !== "_").join(""));
  return success(int);
}

export function float(scanner: Scanner): ParseResult<number> {
  scanner.nextUntilChar({ inline: true });

  // lookahead validation is needed for integer value is similar to float
  let position = 0;
  while (
    scanner.char(position) &&
    !END_OF_VALUE_REGEXP.test(scanner.char(position))
  ) {
    if (!FLOAT_REGEXP.test(scanner.char(position))) return failure();
    position++;
  }

  const acc = [];
  if (/[+-]/.test(scanner.char())) {
    acc.push(scanner.char());
    scanner.next();
  }
  while (FLOAT_REGEXP.test(scanner.char()) && !scanner.eof()) {
    acc.push(scanner.char());
    scanner.next();
  }

  if (acc.length === 0) return failure();
  const float = parseFloat(acc.filter((char) => char !== "_").join(""));
  if (isNaN(float)) return failure();

  return success(float);
}

export function dateTime(scanner: Scanner): ParseResult<Date> {
  scanner.nextUntilChar({ inline: true });

  let dateStr = scanner.slice(0, 10);
  // example: 1979-05-27
  if (!/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return failure();
  scanner.next(10);

  const acc = [];
  // example: 1979-05-27T00:32:00Z
  while (/[ 0-9TZ.:-]/.test(scanner.char()) && !scanner.eof()) {
    acc.push(scanner.char());
    scanner.next();
  }
  dateStr += acc.join("");
  const date = new Date(dateStr.trim());
  // invalid date
  if (isNaN(date.getTime())) {
    throw new SyntaxError(`Invalid date string "${dateStr}"`);
  }

  return success(date);
}

export function localTime(scanner: Scanner): ParseResult<string> {
  scanner.nextUntilChar({ inline: true });

  let timeStr = scanner.slice(0, 8);
  if (!/^(\d{2}):(\d{2}):(\d{2})/.test(timeStr)) return failure();
  scanner.next(8);

  const acc = [];
  if (scanner.char() !== ".") return success(timeStr);
  acc.push(scanner.char());
  scanner.next();

  while (/[0-9]/.test(scanner.char()) && !scanner.eof()) {
    acc.push(scanner.char());
    scanner.next();
  }
  timeStr += acc.join("");
  return success(timeStr);
}

export function arrayValue(scanner: Scanner): ParseResult<unknown[]> {
  scanner.nextUntilChar({ inline: true });

  if (scanner.char() !== "[") return failure();
  scanner.next();

  const array: unknown[] = [];
  while (!scanner.eof()) {
    scanner.nextUntilChar();
    const result = value(scanner);
    if (!result.ok) break;
    array.push(result.body);
    scanner.nextUntilChar({ inline: true });
    // may have a next item, but trailing comma is allowed at array
    if (scanner.char() !== ",") break;
    scanner.next();
  }
  scanner.nextUntilChar();

  if (scanner.char() !== "]") throw new SyntaxError("Array is not closed");
  scanner.next();

  return success(array);
}

export function inlineTable(
  scanner: Scanner,
): ParseResult<Record<string, unknown>> {
  scanner.nextUntilChar();
  if (scanner.char(1) === "}") {
    scanner.next(2);
    return success({});
  }
  const pairs = surround(
    "{",
    join(pair, ","),
    "}",
  )(scanner);
  if (!pairs.ok) return failure();
  let table = {};
  for (const pair of pairs.body) {
    table = deepMerge(table, pair);
  }
  return success(table);
}

export const value = or([
  multilineBasicString,
  multilineLiteralString,
  basicString,
  literalString,
  symbols,
  dateTime,
  localTime,
  float,
  integer,
  arrayValue,
  inlineTable,
]);

export const pair = kv(dottedKey, "=", value);

export function block(
  scanner: Scanner,
): ParseResult<BlockParseResultBody> {
  scanner.nextUntilChar();
  const result = merge(repeat(pair))(scanner);
  if (result.ok) return success({ type: "Block", value: result.body });
  return failure();
}

export const tableHeader = surround("[", dottedKey, "]");

export function table(scanner: Scanner): ParseResult<BlockParseResultBody> {
  scanner.nextUntilChar();
  const header = tableHeader(scanner);
  if (!header.ok) return failure();
  scanner.nextUntilChar();
  const b = block(scanner);
  return success({
    type: "Table",
    key: header.body,
    value: b.ok ? b.body.value : {},
  });
}

export const tableArrayHeader = surround("[[", dottedKey, "]]");

export function tableArray(
  scanner: Scanner,
): ParseResult<BlockParseResultBody> {
  scanner.nextUntilChar();
  const header = tableArrayHeader(scanner);
  if (!header.ok) return failure();
  scanner.nextUntilChar();
  const b = block(scanner);
  return success({
    type: "TableArray",
    key: header.body,
    value: b.ok ? b.body.value : {},
  });
}

export function toml(
  scanner: Scanner,
): ParseResult<Record<string, unknown>> {
  const blocks = repeat(or([block, tableArray, table]))(scanner);
  if (!blocks.ok) return failure();
  let body = {};
  for (const block of blocks.body) {
    switch (block.type) {
      case "Block": {
        body = deepMerge(body, block.value);
        break;
      }
      case "Table": {
        deepAssignWithTable(body, block);
        break;
      }
      case "TableArray": {
        deepAssignWithTable(body, block);
        break;
      }
    }
  }
  return success(body);
}

export function parserFactory<T>(parser: ParserComponent<T>) {
  return (tomlString: string): T => {
    const scanner = new Scanner(tomlString);

    let parsed: ParseResult<T> | null = null;
    let err: Error | null = null;
    try {
      parsed = parser(scanner);
    } catch (e) {
      err = e instanceof Error ? e : new Error("Invalid error type caught");
    }

    if (err || !parsed || !parsed.ok || !scanner.eof()) {
      const position = scanner.position();
      const subStr = tomlString.slice(0, position);
      const lines = subStr.split("\n");
      const row = lines.length;
      const column = (() => {
        let count = subStr.length;
        for (const line of lines) {
          if (count <= line.length) break;
          count -= line.length + 1;
        }
        return count;
      })();
      const message = `Parse error on line ${row}, column ${column}: ${
        err ? err.message : `Unexpected character: "${scanner.char()}"`
      }`;
      throw new SyntaxError(message);
    }
    return parsed.body;
  };
}
