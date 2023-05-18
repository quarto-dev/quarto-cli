/*
 * parsing.ts
 *
 * Copyright (C) 2022 Posit Software, PBC
 */

import { UnreachableError } from "../error.ts";
import { asMappedString, MappedString, mappedString } from "../mapped-text.ts";
import { rangedLines } from "../ranged-text.ts";
import { lineColToIndex, lines } from "../text.ts";
import {
  LocateFromIndentationContext,
  YamlIntelligenceContext,
} from "./types.ts";

// deno-lint-ignore no-explicit-any
let _parser: any;

interface WithTreeSitter {
  // deno-lint-ignore no-explicit-any
  TreeSitter: any;
}

// deno-lint-ignore no-explicit-any
export function setTreeSitter(parser: any) {
  _parser = parser;
}

// deno-lint-ignore no-explicit-any
export function getTreeSitterSync(): any {
  if (_parser === undefined) {
    throw new Error("tree-sitter uninitialized");
  }
  return _parser;
}

// deno-lint-ignore no-explicit-any
export async function getTreeSitter(): Promise<any> {
  if (_parser) {
    return _parser;
  }

  // this is to appease the type-checker, and should never run
  // in the CLI.
  // deno-lint-ignore no-explicit-any
  let Parser: any;
  try {
    Parser = ((self as unknown) as WithTreeSitter).TreeSitter;
  } catch (_e) {
    Parser = ((globalThis as unknown) as WithTreeSitter).TreeSitter;
  }

  await Parser.init();

  _parser = new Parser();

  const treeSitterYamlJson = (await import(
    "../../../resources/editor/tools/yaml/tree-sitter-yaml.json",
    { assert: { type: "json" } }
  )).default as { data: number[] };

  const YAML = await Parser.Language.load(
    new Uint8Array(treeSitterYamlJson.data),
  );

  _parser.setLanguage(YAML);
  return _parser;
}

export interface ParseAttemptResult {
  code: MappedString;
  // deno-lint-ignore no-explicit-any
  parse: any;
  deletions: number;
}

export function* attemptParsesAtLine(
  context: YamlIntelligenceContext,
  // deno-lint-ignore no-explicit-any
  parser: any,
): Generator<ParseAttemptResult> {
  const {
    position, // row/column of cursor (0-based)
  } = context;

  // full contents of the buffer
  const code = asMappedString(context.code);

  try {
    const tree = parser.parse(code.value);
    if (tree.rootNode.type !== "ERROR") {
      yield {
        parse: tree,
        code,
        deletions: 0,
      };
    }
  } catch (_e) {
    // bail on internal error from tree-sitter.
    return;
  }

  const codeLines = rangedLines(code.value, true);

  // in markdown files, we are passed chunks of text one at a time, and
  // sometimes the cursor lies outside those chunks. In that case, we cannot
  // attempt to fix the parse by deleting character, and so we simply bail.
  if (position.row >= codeLines.length || position.row < 0) {
    return;
  }

  const currentLine = codeLines[position.row].substring;
  let currentColumn = position.column;
  let deletions = 0;
  const locF = lineColToIndex(code.value);

  while (currentColumn > 0) {
    currentColumn--;
    deletions++;

    const chunks = [];
    if (position.row > 0) {
      chunks.push({
        start: 0,
        end: codeLines[position.row - 1].range.end,
      });
    }

    if (position.column > deletions) {
      chunks.push({
        start: locF({ line: position.row, column: 0 }),
        end: locF({ line: position.row, column: position.column - deletions }),
      });
    }

    if (position.row + 1 < codeLines.length) {
      chunks.push({
        start: locF({ line: position.row, column: currentLine.length - 1 }),
        end: locF({ line: position.row + 1, column: 0 }),
      });
      chunks.push({
        start: codeLines[position.row + 1].range.start,
        end: codeLines[codeLines.length - 1].range.end,
      });
    }
    const newCode = mappedString(code, chunks);

    const tree = parser.parse(newCode.value);
    if (tree.rootNode.type !== "ERROR") {
      yield {
        parse: tree,
        code: newCode,
        deletions,
      };
    }
  }
}

function getIndent(l: string) {
  return l.length - l.trimStart().length;
}

export function getYamlPredecessors(code: string, row: number) {
  const yamlIndentTree = getYamlIndentTree(code).predecessor;
  const result = [];
  while (
    row !== undefined && row !== -1 && row >= 0 && row < yamlIndentTree.length
  ) {
    result.push(row);
    row = yamlIndentTree[row];
  }
  return result;
}

export function getYamlIndentTree(code: string) {
  const ls = lines(code);
  const predecessor: number[] = [];
  const indents: number[] = [];

  let indentation = -1;
  let prevPredecessor = -1;
  for (let i = 0; i < ls.length; ++i) {
    const line = ls[i];
    const lineIndent = getIndent(line);
    indents.push(lineIndent);

    if (lineIndent > indentation) {
      predecessor[i] = prevPredecessor;
      prevPredecessor = i;
      indentation = lineIndent;
    } else if (line.trim().length === 0) {
      predecessor[i] = predecessor[prevPredecessor];
    } else if (lineIndent === indentation) {
      predecessor[i] = predecessor[prevPredecessor];
      prevPredecessor = i;
    } else if (lineIndent < indentation) {
      // go down the predecessor relation
      let v = prevPredecessor;
      while (v >= 0 && indents[v] >= lineIndent) {
        v = predecessor[v];
      }
      predecessor[i] = v;
      prevPredecessor = i;
      indentation = lineIndent;
    } else {
      throw new UnreachableError();
    }
  }
  return {
    predecessor,
    indentation: indents,
  };
}

export function locateFromIndentation(
  context: LocateFromIndentationContext,
): (number | string)[] {
  const {
    line, // editing line up to the cursor
    code: mappedCode, // full contents of the buffer
    position, // row/column of cursor (0-based)
  } = context;

  // currently we don't need mappedstrings here, so we cast to string
  const code = asMappedString(mappedCode).value;

  const { predecessor, indentation } = getYamlIndentTree(code);

  const ls = lines(code);
  let lineNo = position.row;
  const path = [];
  const lineIndent = getIndent(line);
  while (lineNo !== -1) {
    const trimmed = ls[lineNo].trim();

    // treat whitespace differently: find first non-whitespace line above it and compare indents
    if (trimmed.length === 0) {
      let prev = lineNo;
      while (prev >= 0 && ls[prev].trim().length === 0) {
        prev--;
      }
      if (prev === -1) {
        // all whitespace..?! we give up.
        break;
      }
      const prevIndent = getIndent(ls[prev]);
      if (prevIndent < lineIndent) {
        // we're indented deeper than the previous indent: Locate through that.
        lineNo = prev;
        continue;
      } else if (prevIndent > lineIndent) {
        // we're indented shallower than the previous indent. We need
        // to locate through the first line that's shallower than us:
        do {
          prev--;
        } while (
          prev >= 0 &&
          (ls[prev].trim().length === 0 || getIndent(ls[prev]) >= lineIndent)
        );
        lineNo = prev;
        continue;
      }
    }
    if (lineIndent >= indentation[lineNo]) {
      if (trimmed.startsWith("-")) {
        // sequence entry
        // we report the wrong number here, but since we don't
        // actually need to know which entry in the array this is in
        // order to navigate the schema, this is fine.
        path.push(0);
      } else if (trimmed.endsWith(":")) {
        // mapping
        path.push(trimmed.substring(0, trimmed.length - 1));
      }
    }
    lineNo = predecessor[lineNo];
  }
  path.reverse();
  return path;
}
