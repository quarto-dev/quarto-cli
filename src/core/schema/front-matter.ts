/*
* front-matter.ts
*
* JSON Schema for Quarto's YAML frontmatter
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import {
  rgb24
} from "fmt/colors.ts";

import {
  formatExecuteOptionsSchema as execute
} from "./types.ts";

import {
  StringSchema as StringS,
  oneOfSchema as oneOfS,
  anySchema as anyS,
  objectSchema as objectS,
  enumSchema as enumS,
} from "./common.ts";

import {
  RenderContext
} from "../../command/render/types.ts";

import {
  breakQuartoMd
} from "../break-quarto-md.ts";

import {
  mappedString,
  asMappedString,
  mappedLineNumbers
} from "../mapped-text.ts";

import {
  rangedLines
} from "../ranged-text.ts";

import {
  formatLineRange,
  lines,
} from "../text.ts";

import {
  YAMLSchema
} from "./yaml-schema.ts";

import {
  error
} from "log/mod.ts";

export const htmlOptionsSchema = anyS;

export const htmlFormatSchema = objectS({
  "html": htmlOptionsSchema
});

export const frontMatterFormatSchema = oneOfS(
  enumS("html"),
  htmlFormatSchema
);

export const frontMatterSchema = {
  "type": "object",
  properties: {
    title: StringS,
    execute,
    format: frontMatterFormatSchema
  }
};

const frontMatter = new YAMLSchema(frontMatterSchema);

export function validateYAMLFrontMatter(context: RenderContext)
{
  const source = asMappedString(Deno.readTextFileSync(context.target.source));
  const nb = breakQuartoMd(source);
  if (nb.cells.length < 1) {
    throw new Error("Couldn't find YAML front matter");
  }
  const firstCell = nb.cells[0];
  if (!firstCell.source.value.startsWith("---")) {
    throw new Error("Expected front matter to start with '---'");
  }
  if (!firstCell.source.value.endsWith("---")) {
    throw new Error("Expected front matter to end with '---'");
  }
  const lineRanges = rangedLines(firstCell.source.value);
  const frontMatterText = mappedString(
    firstCell.source,
    [{ start: lineRanges[1].range.start, end: lineRanges[lineRanges.length - 2].range.end }]
  );

  const result = frontMatter.parseAndValidate(frontMatterText);
  const locF = mappedLineNumbers(frontMatterText);
  const nLines = lines(frontMatterText.originalString).length;
  if (result.errors.length) {
    error("Validation of YAML front matter failed.");
    for (const err of result.errors) {
      error(err.message);
      error(rgb24("=====", 0x800000));
      const start = locF(err.violatingObject.start);
      const end = locF(err.violatingObject.end);
      const {
        prefixWidth,
        lines
      } = formatLineRange(
        frontMatterText.originalString,
        Math.max(0, start.line - 1),
        Math.min(end.line + 1, nLines - 1))
      for (const { lineNumber, content, rawLine } of lines) {
        error(content);
        if (lineNumber >= start.line && lineNumber <= end.line) {
          const startColumn = (lineNumber > start.line ? 0 : start.column);
          const endColumn = (lineNumber < end.line ? rawLine.length : end.column);
          error(" ".repeat(prefixWidth + startColumn + 1) + "^".repeat(endColumn - startColumn));
        }
      }
      error(rgb24("=====", 0x800000));
    }
    throw new Error();
  }
  
}
