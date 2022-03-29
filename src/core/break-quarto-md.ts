/*
* break-quarto-md.ts
*
* Breaks up a qmd file into a list of chunks of related text: YAML
* front matter, "pure" markdown, triple-backtick sections, and so on.
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { lines } from "./lib/text.ts";
import { Range, rangedLines, RangedSubstring } from "./lib/ranged-text.ts";
import { MappedString, mappedString } from "./lib/mapped-text.ts";

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
  src: MappedString,
  validate = false,
) {
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
  const endCodeRegEx = /^```\s*$/;
  const delimitMathBlockRegEx = /^\$\$/;
  let language = ""; // current language block

  // line buffer
  const lineBuffer: RangedSubstring[] = [];
  const flushLineBuffer = async (
    cell_type: "markdown" | "code" | "raw" | "math",
    index: number,
  ) => {
    if (lineBuffer.length) {
      if (lineBuffer[lineBuffer.length - 1].substring === "") {
        lineBuffer.splice(lineBuffer.length - 1, 1);
      }

      const mappedChunks: (string | Range)[] = [];
      for (const line of lineBuffer) {
        mappedChunks.push(line.range);
        mappedChunks.push("\n");
      }
      mappedChunks.pop();
      const source = mappedString(src, mappedChunks);

      const cell: QuartoMdCell = {
        // deno-lint-ignore camelcase
        cell_type: cell_type === "code" ? { language } : cell_type,
        source: source,
        sourceOffset: 0,
        sourceStartLine: 0,
        sourceVerbatim: source,
        cellStartLine: index,
      };

      if (cell_type === "code" && (language === "ojs" || language === "dot")) {
        // see if there is embedded metadata we should forward into the cell metadata
        const { yaml, source, sourceStartLine } =
          await partitionCellOptionsMapped(
            language,
            cell.source,
            validate,
          );
        // TODO I'd prefer for this not to depend on sourceStartLine now
        // that we have mapped strings infrastructure
        const breaks = Array.from(cell.source.value.matchAll(/\r?\n/g));
        let strUpToLastBreak = "";
        if (sourceStartLine > 0) {
          if (breaks.length) {
            // TODO matchAll apparently breaks typechecking?
            // "error: TS2538 [ERROR]: Type 'RegExpMatchArray' cannot be used as an index type.
            const lastBreak =
              // deno-lint-ignore no-explicit-any
              breaks[Math.min(sourceStartLine - 1, breaks.length - 1)] as any;
            const pos = lastBreak.index + lastBreak[0].length;
            strUpToLastBreak = cell.source.value.substring(0, pos);
          } else {
            strUpToLastBreak = cell.source.value;
          }
        }
        cell.sourceOffset = strUpToLastBreak.length + "```{ojs}\n".length;
        cell.sourceVerbatim = mappedString(
          cell.sourceVerbatim,
          [
            "```{ojs}\n",
            { start: 0, end: cell.sourceVerbatim.value.length },
            "\n```",
          ],
        );
        cell.source = source;
        cell.options = yaml;
        cell.sourceStartLine = sourceStartLine;
      }

      // cell.source = mdTrimEmptyLines(cell.source);
      // if the source is empty then don't add it
      if (mdTrimEmptyLines(lines(cell.source.value)).length > 0) {
        nb.cells.push(cell);
      }

      lineBuffer.splice(0, lineBuffer.length);
    }
  };

  // loop through lines and create cells based on state transitions
  let inYaml = false,
    inMathBlock = false,
    inCodeCell = false,
    inCode = false;

  const srcLines = rangedLines(src.value);

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
    else if (startCodeCellRegEx.test(line.substring)) {
      const m = line.substring.match(startCodeCellRegEx);
      language = (m as string[])[1];
      await flushLineBuffer("markdown", i);
      inCodeCell = true;

      // end code block: ^``` (tolerate trailing ws)
    } else if (endCodeRegEx.test(line.substring)) {
      // in a code cell, flush it
      if (inCodeCell) {
        inCodeCell = false;
        await flushLineBuffer("code", i);

        // otherwise this flips the state of in-code
      } else {
        inCode = !inCode;
        lineBuffer.push(line);
      }

      // begin code block: ^```
    } else if (startCodeRegEx.test(line.substring)) {
      inCode = true;
      lineBuffer.push(line);
    } else if (delimitMathBlockRegEx.test(line.substring)) {
      if (inMathBlock) {
        lineBuffer.push(line);
        await flushLineBuffer("math", i);
      } else {
        if (inYaml || inCode || inCodeCell) {
          // TODO: signal a parse error?
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
