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
import { rangedLines, rangedSubstring, RangedSubstring, Range } from "./ranged-text.ts";
import { mappedString, MappedString, mappedConcat } from "./mapped-text.ts";

import { partitionCellOptionsMapped } from "./partition-cell-options.ts";

export interface CodeCellType {
  language: string;
}

export interface QuartoMdCell {
  id?: string;

  // deno-lint-ignore camelcase
  cell_type: CodeCellType | "markdown" | "raw" | "math";
  options?: MappedString;

  source: MappedString,
  sourceVerbatim: MappedString,

  sourceOffset: number; // FIXME these might be unnecessary now. Check back
  sourceStartLine: number;
}

export interface QuartoMdChunks {
  cells: QuartoMdCell[];
}

export function breakQuartoMd(
  src: MappedString,
  validate = false
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
  const flushLineBuffer = (
    cell_type: "markdown" | "code" | "raw" | "math",
  ) => {
    if (lineBuffer.length) {
      // FIXME: understand why was this here. This makes our line
      // count computations wrong
      //
      // if (lineBuffer[lineBuffer.length - 1].substring === "") {
      //   lineBuffer.splice(lineBuffer.length - 1, 1);
      // }

      const mappedChunks: (string | Range)[] = [];
      for (const line of lineBuffer) {
        mappedChunks.push(line.range);
      }

      const source = mappedString(src, mappedChunks);
      
      // const sourceLines = lineBuffer.map((line, index) => {
      //   return mappedString(line + (index < (lineBuffer.length - 1) ? "\n" : "");
      // });

      const cell: QuartoMdCell = {
        // deno-lint-ignore camelcase
        cell_type: cell_type === "code" ? { language } : cell_type,
        source: source,
        sourceOffset: 0,
        sourceStartLine: 0,
        sourceVerbatim: source,
      };

      if (cell_type === "code" && (language === "ojs" || language === "dot")) {
        // see if there is embedded metadata we should forward into the cell metadata
        const { yaml, source, sourceStartLine } = partitionCellOptionsMapped(
          language,
          cell.source,
          validate
        );
        // FIXME I'd prefer for this not to depend on sourceStartLine now
        // that we have mapped strings infrastructure
        const breaks = lineOffsets(cell.source.value).slice(1);
        let strUpToLastBreak = "";
        if (sourceStartLine > 0) {
          if (breaks.length) {
            const lastBreak = breaks[Math.min(sourceStartLine - 1, breaks.length - 1)];
            // const pos = lastBreak.index + lastBreak[0].length;
            strUpToLastBreak = cell.source.value.substring(0, lastBreak);
          } else {
            strUpToLastBreak = cell.source.value;
          }
        }
        cell.sourceOffset = strUpToLastBreak.length + "```{ojs}\n".length;
        cell.sourceVerbatim = mappedString(
          cell.sourceVerbatim, [
            "```{ojs}\n",
            { start: 0, end: cell.sourceVerbatim.value.length },
            "\n```"
          ]);
        cell.source = source;
        cell.options = yaml;
        cell.sourceStartLine = sourceStartLine;
      }

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

  const srcLines = rangedLines(src.value, true);
  for (const line of srcLines) {
    // yaml front matter
    if (yamlRegEx.test(line.substring) && !inCodeCell && !inCode && !inMathBlock) {
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
    else if (startCodeCellRegEx.test(line.substring)) {
      const m = line.substring.match(startCodeCellRegEx);
      language = (m as string[])[1];
      flushLineBuffer("markdown");
      inCodeCell = true;

      // end code block: ^``` (tolerate trailing ws)
    } else if (endCodeRegEx.test(line.substring)) {
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
    } else if (startCodeRegEx.test(line.substring)) {
      inCode = true;
      lineBuffer.push(line);
    } else if (delimitMathBlockRegEx.test(line.substring)) {
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
