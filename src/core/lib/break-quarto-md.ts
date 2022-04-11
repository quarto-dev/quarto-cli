/*
* break-quarto-md.ts
*
* Breaks up a qmd file into a list of chunks of related text: YAML
* front matter, "pure" markdown, triple-backtick sections, and so on.
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { lineOffsets, lines } from "./text.ts";
import { Range, rangedLines, RangedSubstring } from "./ranged-text.ts";
import {
  asMappedString,
  EitherString,
  MappedString,
  mappedString,
} from "./mapped-text.ts";

import { partitionCellOptionsMapped } from "./partition-cell-options.ts";

export interface CodeCellType {
  language: string;
}

export interface QuartoMdCell {
  id?: string;

  // deno-lint-ignore camelcase
  cell_type: CodeCellType | "markdown" | "raw" | "math";
  options?: Record<string, unknown>;

  source: MappedString;
  sourceVerbatim: MappedString;

  sourceOffset: number; // TODO these might be unnecessary now. Check back
  sourceStartLine: number;

  // line number of the start of the cell in the file, 0-based.
  //
  // NB this number means slightly different things depending on the
  // cell type. for markdown and raw cells, it's literally the first
  // line in the file corresponding to the cell. for code cells,
  // though, it's the first line of the _content_: it skips the triple
  // ticks.

  cellStartLine: number;
}

export interface QuartoMdChunks {
  cells: QuartoMdCell[];
}

export async function breakQuartoMd(
  src: EitherString,
  validate = false,
) {
  if (typeof src === "string") {
    src = asMappedString(src);
  }

  // notebook to return
  const nb: QuartoMdChunks = {
    cells: [],
  };

  // regexes
  const yamlRegEx = /^---\s*$/;
  const startCodeCellRegEx = new RegExp(
    "^\\s*```+\\s*\\{([=A-Za-z]+)( *[ ,].*)?\\}\\s*$",
  );
  const startCodeRegEx = /^```/;
  const endCodeRegEx = /^```+\s*$/;
  const delimitMathBlockRegEx = /^\$\$/;
  let language = ""; // current language block
  let cellStartLine = 0;

  // line buffer
  let codeStartRange: RangedSubstring;
  let codeEndRange: RangedSubstring;

  const lineBuffer: RangedSubstring[] = [];
  const flushLineBuffer = async (
    cell_type: "markdown" | "code" | "raw" | "math",
    index: number,
  ) => {
    if (lineBuffer.length) {
      // TODO understand why was this here. This makes our line
      // count computations wrong
      //
      // if (lineBuffer[lineBuffer.length - 1].substring === "") {
      //   lineBuffer.splice(lineBuffer.length - 1, 1);
      // }

      const mappedChunks: Range[] = [];
      for (const line of lineBuffer) {
        mappedChunks.push(line.range);
      }

      const source = mappedString(src, mappedChunks);

      const cell: QuartoMdCell = {
        // deno-lint-ignore camelcase
        cell_type: cell_type === "code" ? { language } : cell_type,
        source,
        sourceOffset: 0,
        sourceStartLine: 0,
        sourceVerbatim: source,
        cellStartLine,
      };

      // the next cell will start on the next index.
      cellStartLine = index + 1;

      if (cell_type === "code") {
        // see if there is embedded metadata we should forward into the cell metadata
        const { yaml, sourceStartLine } = await partitionCellOptionsMapped(
          language,
          cell.source,
          validate,
        );
        // TODO I'd prefer for this not to depend on sourceStartLine now
        // that we have mapped strings infrastructure
        const breaks = Array.from(lineOffsets(cell.source.value)).slice(1);
        let strUpToLastBreak = "";
        if (sourceStartLine > 0) {
          if (breaks.length) {
            const lastBreak =
              breaks[Math.min(sourceStartLine - 1, breaks.length - 1)];
            strUpToLastBreak = cell.source.value.substring(0, lastBreak);
          } else {
            strUpToLastBreak = cell.source.value;
          }
        }
        // TODO Fix ugly way to compute sourceOffset..
        const prefix = "```{" + language + "}\n";
        cell.sourceOffset = strUpToLastBreak.length + prefix.length;

        cell.sourceVerbatim = mappedString(src, [
          codeStartRange!.range,
          ...mappedChunks,
          codeEndRange!.range,
        ]);
        cell.options = yaml;
        cell.sourceStartLine = sourceStartLine;
      }

      // if the source is empty then don't add it
      if (
        mdTrimEmptyLines(lines(cell.source.value)).length > 0 ||
        cell.options !== undefined
      ) {
        nb.cells.push(cell);
      }

      lineBuffer.splice(0, lineBuffer.length);
    }
  };

  const tickCount = (s: string): number =>
    Array.from(s.split(" ")[0] || "").filter((c) => c === "`").length;

  // loop through lines and create cells based on state transitions
  let inYaml = false,
    inMathBlock = false,
    inCodeCell = false,
    inCode = 0; // inCode stores the tick count of the code block

  const srcLines = rangedLines(src.value, true);

  for (let i = 0; i < srcLines.length; ++i) {
    const line = srcLines[i];
    // yaml front matter
    if (
      yamlRegEx.test(line.substring) && !inCodeCell && !inCode && !inMathBlock
    ) {
      if (inYaml) {
        lineBuffer.push(line);
        await flushLineBuffer("raw", i);
        inYaml = false;
      } else {
        await flushLineBuffer("markdown", i);
        lineBuffer.push(line);
        inYaml = true;
      }
    } // begin code cell: ^```python
    else if (startCodeCellRegEx.test(line.substring) && (inCode === 0)) {
      const m = line.substring.match(startCodeCellRegEx);
      language = (m as string[])[1];
      await flushLineBuffer("markdown", i);
      inCodeCell = true;
      codeStartRange = line;

      // end code block: ^``` (tolerate trailing ws)
    } else if (
      endCodeRegEx.test(line.substring) &&
      (inCodeCell || (inCode && tickCount(line.substring) === inCode))
    ) {
      // in a code cell, flush it
      if (inCodeCell) {
        codeEndRange = line;
        inCodeCell = false;
        await flushLineBuffer("code", i);
      } else {
        // otherwise, sets inCode to 0 and continue
        inCode = 0;
        lineBuffer.push(line);
      }

      // begin code block: ^```
    } else if (startCodeRegEx.test(line.substring)) {
      inCode = tickCount(line.substring);
      lineBuffer.push(line);
    } else if (delimitMathBlockRegEx.test(line.substring)) {
      if (inMathBlock) {
        lineBuffer.push(line);
        await flushLineBuffer("math", i);
      } else {
        if (inYaml || inCode || inCodeCell) {
          // TODO signal a parse error?
          // for now, we just skip.
        } else {
          await flushLineBuffer("markdown", i);
        }
        lineBuffer.push(line);
      }
      inMathBlock = !inMathBlock;
    } else {
      lineBuffer.push(line);
    }
  }

  // if there is still a line buffer then make it a markdown cell
  await flushLineBuffer("markdown", srcLines.length);

  return nb;
}

function mdTrimEmptyLines(lines: string[]) {
  // trim leading lines
  const firstNonEmpty = lines.findIndex((line) => line.trim().length > 0);
  if (firstNonEmpty === -1) {
    return [];
  }
  lines = lines.slice(firstNonEmpty);

  // trim trailing lines
  let lastNonEmpty = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim().length > 0) {
      lastNonEmpty = i;
      break;
    }
  }

  if (lastNonEmpty > -1) {
    lines = lines.slice(0, lastNonEmpty + 1);
  }

  return lines;
}
