/*
* parsing.js
* 
* Copyright (C) 2021 by RStudio, PBC
*
*/

import * as core from "../../../build/core-lib.js";
import { getLocalPath } from "./paths.js";

let _parser;

export async function getTreeSitter() {
  if (_parser) {
    return _parser;
  }

  const Parser = window.TreeSitter;

  await Parser.init();

  _parser = new Parser();

  // FIXME check if this shouldn't be parameterized somehow.
  const YAML = await Parser.Language.load(
    getLocalPath("tree-sitter-yaml.wasm")
  );

  _parser.setLanguage(YAML);
  return _parser;
}

export function* attemptParsesAtLine(context, parser) {
  let {
    code, // full contents of the buffer
    position, // row/column of cursor (0-based)
  } = context;

  if (code.value === undefined) {
    code = core.asMappedString(code);
  }

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

  const codeLines = core.rangedLines(code.value, true);

  // in markdown files, we are passed chunks of text one at a time, and
  // sometimes the cursor lies outside those chunks. In that case, we cannot
  // attempt to fix the parse by deleting character, and so we simply bail.
  if (position.row >= codeLines.length || position.row < 0) {
    return;
  }

  const currentLine = codeLines[position.row].substring;
  let currentColumn = position.column;
  let deletions = 0;
  const locF = core.rowColToIndex(code.value);

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
        start: locF({ row: position.row, column: 0 }),
        end: locF({ row: position.row, column: position.column - deletions }),
      });
    }

    if (position.row + 1 < codeLines.length) {
      chunks.push({
        start: locF({ row: position.row, column: currentLine.length - 1 }),
        end: locF({ row: position.row + 1, column: 0 }),
      });
      chunks.push({
        start: codeLines[position.row + 1].range.start,
        end: codeLines[codeLines.length - 1].range.end,
      });
    }
    const newCode = core.mappedString(code, chunks);

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

function getIndent(l) {
  return l.length - l.trimStart().length;
}

export function getYamlIndentTree(code) {
  const lines = core.lines(code);
  const predecessor = [];
  const indents = [];

  let indentation = -1;
  let prevPredecessor = -1;
  for (let i = 0; i < lines.length; ++i) {
    const line = lines[i];
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
      throw new Error("Internal error, should never have arrived here");
    }
  }
  return {
    predecessor,
    indentation: indents,
  };
}

export function locateFromIndentation(context) {
  let {
    line, // editing line up to the cursor
    code, // full contents of the buffer
    position, // row/column of cursor (0-based)
  } = context;

  // currently we don't need mappedstrings here, so we cast to string
  if (code.value !== undefined) {
    code = code.value;
  }

  const { predecessor, indentation } = getYamlIndentTree(code);

  const lines = core.lines(code);
  let lineNo = position.row;
  const path = [];
  const lineIndent = getIndent(line);
  while (lineNo !== -1) {
    const trimmed = lines[lineNo].trim();

    // treat whitespace differently: find first non-whitespace line above it and compare indents
    if (trimmed.length === 0) {
      let prev = lineNo;
      while (prev >= 0 && lines[prev].trim().length === 0) {
        prev--;
      }
      if (prev === -1) {
        // all whitespace..?! we give up.
        break;
      }
      const prevIndent = getIndent(lines[prev]);
      if (prevIndent < lineIndent) {
        // we're indented deeper than the previous indent: Locate through that.
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
      } else if (trimmed.length !== 0) {
        // parse error?
        return undefined;
      }
    }
    lineNo = predecessor[lineNo];
  }
  path.reverse();
  return path;
}
