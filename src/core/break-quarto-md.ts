/*
* break-quarto-md.ts
*
* Breaks up a qmd file into a list of chunks of related text: YAML
* front matter, "pure" markdown, triple-backtick sections, and so on.
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { lines } from "./text.ts";
import { partitionCellOptions } from "./partition-cell-options.ts";

export interface CodeCellType {
  language: string;
}

export interface QuartoMdCell {
  id?: string;

  // deno-lint-ignore camelcase
  cell_type: CodeCellType | "markdown" | "raw" | "math";
  options?: Record<string, unknown>;

  source: string[];
  sourceVerbatim: string; // for error reporting and echo: fenced
  sourceOffset: number;
  sourceStartLine: number;
}

export interface QuartoMdChunks {
  cells: QuartoMdCell[];
}

export function breakQuartoMd(
  src: string,
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
  const lineBuffer: string[] = [];
  const flushLineBuffer = (
    cell_type: "markdown" | "code" | "raw" | "math",
  ) => {
    if (lineBuffer.length) {
      if (lineBuffer[lineBuffer.length - 1] === "") {
        lineBuffer.splice(lineBuffer.length - 1, 1);
      }

      const sourceLines = lineBuffer.map((line, index) => {
        return line + (index < (lineBuffer.length - 1) ? "\n" : "");
      });

      const cell: QuartoMdCell = {
        // deno-lint-ignore camelcase
        cell_type: cell_type === "code" ? { language } : cell_type,
        source: sourceLines,
        sourceOffset: 0,
        sourceStartLine: 0,
        sourceVerbatim: sourceLines.join(""),
      };

      if (cell_type === "code" && (language === "ojs" || language === "dot")) {
        // see if there is embedded metadata we should forward into the cell metadata
        const { yaml, source, sourceStartLine } = partitionCellOptions(
          "js",
          cell.source,
        );
        cell.sourceOffset =
          cell.source.slice(0, sourceStartLine).join("").length +
          "```{ojs}\n".length;
        cell.sourceVerbatim = "```{ojs}\n" + cell.sourceVerbatim + "\n```";
        cell.source = source;
        cell.options = yaml;
        cell.sourceStartLine = sourceStartLine;
      }

      // cell.source = mdTrimEmptyLines(cell.source);
      // if the source is empty then don't add it
      if (mdTrimEmptyLines(cell.source).length > 0) {
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
  for (const line of lines(src)) {
    // yaml front matter
    if (yamlRegEx.test(line) && !inCodeCell && !inCode && !inMathBlock) {
      if (inYaml) {
        lineBuffer.push(line);
        flushLineBuffer("raw");
        inYaml = false;
      } else {
        flushLineBuffer("markdown");
        lineBuffer.push(line);
        inYaml = true;
      }
    } // begin code cell: ^```python
    else if (startCodeCellRegEx.test(line)) {
      const m = line.match(startCodeCellRegEx);
      language = (m as string[])[1];
      flushLineBuffer("markdown");
      inCodeCell = true;

      // end code block: ^``` (tolerate trailing ws)
    } else if (endCodeRegEx.test(line)) {
      // in a code cell, flush it
      if (inCodeCell) {
        inCodeCell = false;
        flushLineBuffer("code");

        // otherwise this flips the state of in-code
      } else {
        inCode = !inCode;
        lineBuffer.push(line);
      }

      // begin code block: ^```
    } else if (startCodeRegEx.test(line)) {
      inCode = true;
      lineBuffer.push(line);
    } else if (delimitMathBlockRegEx.test(line)) {
      if (inMathBlock) {
        flushLineBuffer("math");
      } else {
        if (inYaml || inCode || inCodeCell) {
          // FIXME: signal a parse error?
          // for now, we just skip.
        } else {
          flushLineBuffer("markdown");
        }
      }
      inMathBlock = !inMathBlock;
      lineBuffer.push(line);
    } else {
      lineBuffer.push(line);
    }
  }

  // if there is still a line buffer then make it a markdown cell
  flushLineBuffer("markdown");

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
