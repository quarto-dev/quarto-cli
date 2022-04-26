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
import { asMappedString, EitherString, mappedString } from "./mapped-text.ts";

import { partitionCellOptionsMapped } from "./partition-cell-options.ts";

import {
  ComponentCell,
  QuartoMdCell,
  QuartoMdChunks,
} from "./break-quarto-md-types.ts";
import { isComponentTag } from "./parse-component-tag.ts";

export type { QuartoMdCell, QuartoMdChunks } from "./break-quarto-md-types.ts";

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
  const openTags: RangedSubstring[] = [];
  const tagName: string[] = [];
  const tagOptions: Record<string, string>[] = []; // tag options needs to be a stack to remember the options as we close the tag
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
      | "math"
      | "empty_component"
      | "component",
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

      const makeCellType = () => {
        if (cell_type === "code") {
          return { language };
        } else if (
          cell_type === "component" || cell_type === "empty_component"
        ) {
          return {
            language: "_component",
            tag: tagName[tagName.length - 1],
            attrs: tagOptions[tagOptions.length - 1]!,
            sourceOpenTag: mappedString(src, [
              openTags[openTags.length - 1].range,
            ]),
            sourceCloseTag: mappedString(src, [
              lineBuffer[lineBuffer.length - 1].range,
            ]),
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
      } else if (cell_type === "empty_component" || cell_type === "component") {
        // components only carry tag source in sourceVerbatim, analogously to code
        cell.source = mappedString(src, mappedChunks.slice(1, -1));
        // components carry options in cell_type, use that
        cell.options = (cell.cell_type as ComponentCell).attrs;
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

  const pushStacks = (
    tagOption: Record<string, string>,
    tagNameVal: string,
    openTag: RangedSubstring,
  ) => {
    tagOptions.push(tagOption);
    tagName.push(tagNameVal);
    openTags.push(openTag);
  };

  const popStacks = () => {
    tagOptions.pop();
    openTags.pop();
    tagName.pop();
  };

  const tickCount = (s: string): number =>
    Array.from(s.split(" ")[0] || "").filter((c) => c === "`").length;

  // loop through lines and create cells based on state transitions
  let inYaml = false,
    inMathBlock = false,
    inCodeCell = false,
    inCode = 0; // inCode stores the tick count of the code block

  const inPlainText = () =>
    !inCodeCell && !inCode && !inMathBlock && !inYaml &&
    tagName.length === 0;

  const srcLines = rangedLines(src.value, true);

  for (let i = 0; i < srcLines.length; ++i) {
    const line = srcLines[i];
    const componentMatch = isComponentTag(line.substring);
    // yaml front matter
    if (
      yamlRegEx.test(line.substring) && !inCodeCell && !inCode &&
      !inMathBlock && tagName.length === 0
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
    } // found empty component
    else if (
      inPlainText() && componentMatch &&
      componentMatch.which === "emptyComponent"
    ) {
      await flushLineBuffer("markdown", i);
      pushStacks(componentMatch.attributes, componentMatch.name, line);
      lineBuffer.push(line);
      await flushLineBuffer("empty_component", i);
      popStacks();
    } // found component start
    else if (
      inPlainText() && componentMatch &&
      componentMatch.which == "startComponent"
    ) {
      await flushLineBuffer("markdown", i);
      pushStacks(componentMatch.attributes, componentMatch.name, line);
      lineBuffer.push(line);
    } // found inner component start
    else if (
      tagName.length > 0 && componentMatch &&
      componentMatch.which === "startComponent"
    ) {
      pushStacks(componentMatch.attributes, componentMatch.name, line);
      lineBuffer.push(line);
    } // found inner component end
    else if (
      tagName.length > 0 && componentMatch &&
      componentMatch.which === "endComponent"
    ) {
      const closeTagName = componentMatch.name as string;
      if (
        tagName[tagName.length - 1].toLocaleLowerCase() !==
          closeTagName.toLocaleLowerCase()
      ) {
        // Mismatched tags, what do we do?
      }
      lineBuffer.push(line);
      if (tagName.length === 1) {
        await flushLineBuffer("component", i);
      }
      popStacks();
    } // begin code cell: ^```python
    else if (startCodeCellRegEx.test(line.substring) && inPlainText()) {
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
        if (inYaml || inCode || inCodeCell || tagName.length > 0) {
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
