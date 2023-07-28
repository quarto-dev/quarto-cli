/*
 * break-quarto-md.ts
 *
 * Breaks up a qmd file into a list of chunks of related text: YAML
 * front matter, "pure" markdown, triple-backtick sections, and so on.
 *
 * Copyright (C) 2021-2022 Posit Software, PBC
 */

import { lineOffsets, lines } from "./text.ts";
import { Range, rangedLines, RangedSubstring } from "./ranged-text.ts";
import {
  asMappedString,
  EitherString,
  mappedString,
  mappedSubstring,
} from "./mapped-text.ts";

import { partitionCellOptionsMapped } from "./partition-cell-options.ts";

import { QuartoMdCell, QuartoMdChunks } from "./break-quarto-md-types.ts";
import { isBlockShortcode } from "./parse-shortcode.ts";
import { Shortcode } from "./parse-shortcode-types.ts";

export type { QuartoMdCell, QuartoMdChunks } from "./break-quarto-md-types.ts";

export async function breakQuartoMd(
  src: EitherString,
  validate = false,
  lenient = false,
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
    "^\\s*(```+)\\s*\\{([=A-Za-z]+)( *[ ,].*)?\\}\\s*$",
  );
  const startCodeRegEx = /^```/;
  const endCodeRegEx = /^\s*```+\s*$/;

  let language = ""; // current language block
  let directiveParams: Shortcode | undefined = undefined;
  let cellStartLine = 0;

  // line buffer
  let codeStartRange: RangedSubstring;
  let codeEndRange: RangedSubstring;

  const lineBuffer: RangedSubstring[] = [];
  const flushLineBuffer = async (
    cell_type:
      | "markdown"
      | "code"
      | "raw"
      | "directive",
    index: number,
  ) => {
    if (lineBuffer.length || cell_type === "code") {
      const mappedChunks: Range[] = [];
      for (const line of lineBuffer) {
        mappedChunks.push(line.range);
      }

      const source = mappedString(src, mappedChunks);

      const makeCellType = () => {
        if (cell_type === "code") {
          return { language };
        } else if (
          cell_type === "directive"
        ) {
          return {
            language: "_directive",
            name: directiveParams!.name,
            shortcode: directiveParams,
          };
        } else {
          return cell_type;
        }
      };

      const cell: QuartoMdCell = {
        // deno-lint-ignore camelcase
        cell_type: makeCellType(),
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
          "",
          lenient,
        );
        // TODO I'd prefer for this not to depend on sourceStartLine now
        // that we have mapped strings infrastructure
        const breaks = Array.from(lineOffsets(cell.source.value));
        let strUpToLastBreak = "";
        if (sourceStartLine > 0) {
          cell.sourceWithYaml = cell.source;
          cell.source = mappedSubstring(cell.source, breaks[sourceStartLine]);

          if (breaks.length > 1) {
            const lastBreak =
              breaks[Math.min(sourceStartLine - 1, breaks.length - 1)];
            strUpToLastBreak = cell.source.value.substring(0, lastBreak);
          } else {
            strUpToLastBreak = cell.source.value;
          }
        } else {
          cell.sourceWithYaml = cell.source;
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
      } else if (cell_type === "directive") {
        // directives only carry tag source in sourceVerbatim, analogously to code
        cell.source = mappedString(src, mappedChunks.slice(1, -1));
      }
      // if the source is empty then don't add it
      if (
        mdTrimEmptyLines(lines(cell.sourceVerbatim.value)).length > 0 ||
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
    inCodeCell = false,
    inCode = 0; // inCode stores the tick count of the code block

  const inPlainText = () => !inCodeCell && !inCode && !inYaml;

  const isYamlDelimiter = (line: string, index: number, skipHRs?: boolean) => {
    if (!yamlRegEx.test(line)) {
      return false;
    }

    // if a yaml delimiter is surrounded by whitespace-only lines,
    // then it is actually an HR element; treat it as such.
    if (
      skipHRs &&
      index > 0 && srcLines[index - 1].substring.trim() === "" &&
      index < srcLines.length - 1 && srcLines[index + 1].substring.trim() === ""
    ) {
      return false;
    }

    return true;
  };

  const srcLines = rangedLines(src.value, true);

  for (let i = 0; i < srcLines.length; ++i) {
    const line = srcLines[i];
    const directiveMatch = isBlockShortcode(line.substring);
    // yaml front matter
    if (
      isYamlDelimiter(line.substring, i, !inYaml) &&
      !inCodeCell && !inCode
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
    } // found empty directive
    else if (inPlainText() && directiveMatch) {
      await flushLineBuffer("markdown", i);
      directiveParams = directiveMatch;
      lineBuffer.push(line);
      await flushLineBuffer("directive", i);
    } // begin code cell: ^```python
    else if (startCodeCellRegEx.test(line.substring) && inPlainText()) {
      const m = line.substring.match(startCodeCellRegEx);
      language = (m as string[])[2];
      await flushLineBuffer("markdown", i);
      inCodeCell = true;
      inCode = tickCount(line.substring);
      codeStartRange = line;

      // end code block: ^``` (tolerate trailing ws)
    } else if (
      endCodeRegEx.test(line.substring) &&
      (inCode && tickCount(line.substring) === inCode)
    ) {
      // in a code cell, flush it
      if (inCodeCell) {
        codeEndRange = line;
        inCodeCell = false;
        inCode = 0;
        await flushLineBuffer("code", i);
      } else {
        // otherwise, sets inCode to 0 and continue
        inCode = 0;
        lineBuffer.push(line);
      }

      // begin code block: ^```
    } else if (startCodeRegEx.test(line.substring) && inCode === 0) {
      inCode = tickCount(line.substring);
      lineBuffer.push(line);
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
