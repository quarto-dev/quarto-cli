/*
* break-quarto-md.ts
*
* Breaks up a qmd file into a list of chunks of related text: YAML
* front matter, "pure" markdown, triple-backtick sections, and so on.
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { shortUuid } from "./uuid.ts";
import {
  readYamlFromMarkdown,
  readYamlFromMarkdownFile,
  readYamlFromString,
} from "./yaml.ts";
import { lines } from "./text.ts";

export interface CodeCellType {
  language: string;
}

export interface QuartoMdCell {
  id?: string;
  cell_type: "markdown" | CodeCellType | "raw" | "math";
  source: string[];
}

export interface QuartoMdChunks {
  cells: QuartoMdCell[];
}

export function breakQuartoMd(
  src: string,
  language: string)
{
  // notebook to return
  const nb: QuartoMdChunks = {
    cells: []
  };

  // regexes
  const yamlRegEx = /^---\s*$/;
  /^\s*```+\s*\{([a-zA-Z0-9_]+)( *[ ,].*)?\}\s*$/;
  const startCodeCellRegEx = new RegExp(
    "^\\s*```+\\s*\\{" + language + "( *[ ,].*)?\\}\\s*$",
  );
  const startCodeRegEx = /^```/;
  const endCodeRegEx = /^```\s*$/;
  const delimitMathBlockRegEx = /^\$\$/;

  // line buffer
  const lineBuffer: string[] = [];
  const flushLineBuffer = (
    cell_type: "markdown" | "code" | "raw" | "math",
    frontMatter?: boolean,
  ) => {
    if (lineBuffer.length) {
      if (lineBuffer[0] === "") {
        lineBuffer.splice(0, 1);
      }
      if (lineBuffer[lineBuffer.length - 1] === "") {
        lineBuffer.splice(lineBuffer.length - 1, 1);
      }
      const cell: QuartoMdCell = {
        cell_type: cell_type === "code" ? { language } : cell_type,
        source: lineBuffer.map((line, index) => {
          return line + (index < (lineBuffer.length - 1) ? "\n" : "");
        }),
      };

      // if the source is empty then don't add it
      cell.source = mdTrimEmptyLines(cell.source);
      if (cell.source.length > 0) {
        nb.cells.push(cell);
      }

      lineBuffer.splice(0, lineBuffer.length);
    }
  };
  
  // loop through lines and create cells based on state transitions
  let parsedFrontMatter = false,
    inYaml = false,
    inMathBlock = false,
    inCodeCell = false,
    inCode = false;
  for (const line of lines(src)) {
    // yaml front matter
    if (yamlRegEx.test(line) && !inCodeCell && !inCode && !inMathBlock) {
      if (inYaml) {
        lineBuffer.push(line);
        flushLineBuffer("raw", !parsedFrontMatter);
        parsedFrontMatter = true;
        inYaml = false;
      } else {
        flushLineBuffer("markdown");
        lineBuffer.push(line);
        inYaml = true;
      }
    } // begin code cell: ^```python
    else if (startCodeCellRegEx.test(line)) {
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
    } else {
      lineBuffer.push(line);
    }
  }

  // if there is still a line buffer then make it a markdown cell
  flushLineBuffer("markdown");

  console.log(JSON.stringify(nb, null, 2));

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
