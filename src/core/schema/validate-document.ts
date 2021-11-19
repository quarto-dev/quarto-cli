/*
* validate-document.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { RenderContext } from "../../command/render/types.ts";
import { breakQuartoMd } from "../break-quarto-md.ts";
import { asMappedString, mappedString } from "../mapped-text.ts";
import { rangedLines } from "../ranged-text.ts";
import { frontMatterValidator } from "./front-matter.ts";
import { readAnnotatedYamlFromMappedString } from "./annotated-yaml.ts";
import { error, info } from "log/mod.ts";
import { LocalizedError } from "../lib/yaml-schema.ts";
import { languageOptionsValidators } from "./chunk-metadata.ts";
import { partitionCellOptionsMapped } from "../partition-cell-options.ts";

export function validateDocumentFromSource(
  src: string,
  error: (msg: string) => any,
  info: (msg: string) => any): LocalizedError[]
{
  const result: LocalizedError[] = [];
  const nb = breakQuartoMd(asMappedString(src));
  if (nb.cells.length < 1) {
    // no cells -> no validation
    return [];
  }
  const firstCell = nb.cells[0];
  let firstContentCellIndex;
  // FIXME this is a syntax error check: we should separate
  // syntax errors from validation.
  if (firstCell.source.value.startsWith("---")) {
    firstContentCellIndex = 1;
    if (!firstCell.source.value.endsWith("---")) {
      throw new Error("Expected front matter to end with '---'");
    }
    // validate the YAML front matter in the document

    const lineRanges = rangedLines(firstCell.source.value);
    const frontMatterText = mappedString(
      firstCell.source,
      [{
        start: lineRanges[1].range.start,
        end: lineRanges[lineRanges.length - 2].range.end,
      }],
    );
    const annotation = readAnnotatedYamlFromMappedString(frontMatterText);
    const fmValidation = frontMatterValidator.validateParseWithErrors(
      frontMatterText,
      annotation,
      "Validation of YAML front matter failed.",
      error,
      info,
    );
    if (fmValidation && fmValidation.errors.length) {
      result.push(...fmValidation.errors);
    }
  } else {
    firstContentCellIndex = 0;
  }

  for (const cell of nb.cells.slice(firstContentCellIndex)) {
    if (
      cell.cell_type === "markdown" ||
      cell.cell_type === "raw" ||
      cell.cell_type === "math"
    ) {
      // not a language chunk
      continue;
    }

    const lang = cell.cell_type.language;
    const validator = languageOptionsValidators[lang];
    if (validator === undefined) {
      // not a language with validators
      continue;
    }

    const chunkResult = partitionCellOptionsMapped(lang, cell.source, true);

    result.push(...chunkResult.yamlValidationErrors);
  }
  return result;
}

export function validateDocument(context: RenderContext): LocalizedError[] {
  if (context.target.markdown === "") {
    // no markdown -> no validation.
    return [];
  }

  return validateDocumentFromSource(context.target.markdown, error, info);
}
