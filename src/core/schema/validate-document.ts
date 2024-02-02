/*
 * validate-document.ts
 *
 * Copyright (C) 2021-2022 Posit Software, PBC
 */

import { RenderContext } from "../../command/render/types.ts";
import { breakQuartoMd } from "../lib/break-quarto-md.ts";
import { mappedString } from "../mapped-text.ts";
import { rangedLines } from "../ranged-text.ts";
import { readAnnotatedYamlFromMappedString } from "./annotated-yaml.ts";
import { error } from "log/mod.ts";
import { partitionCellOptionsMapped } from "../lib/partition-cell-options.ts";
import { withValidator } from "../lib/yaml-validation/validator-queue.ts";
import { ValidationError } from "./validated-yaml.ts";

import { reportOnce, tidyverseFormatError } from "../lib/errors.ts";
import { TidyverseError } from "../lib/errors-types.ts";
import { isObject } from "../lodash.ts";

import { getFrontMatterSchema } from "../lib/yaml-schema/front-matter.ts";
import { JSONValue, LocalizedError } from "../lib/yaml-schema/types.ts";
import { MappedString } from "../lib/mapped-text.ts";

export async function validateDocumentFromSource(
  src: MappedString,
  engine: string,
  // deno-lint-ignore no-explicit-any
  errorFn: (msg: string) => any,
): Promise<LocalizedError[]> {
  const result: LocalizedError[] = [];
  const reportSet: Set<string> = new Set();

  const nb = await breakQuartoMd(src);

  if (nb.cells.length < 1) {
    // no cells -> no validation
    return [];
  }
  const firstCell = nb.cells[0];
  let firstContentCellIndex;
  // TODO this is a syntax error check: we should separate
  // syntax errors from validation.
  if (firstCell.source.value.startsWith("---")) {
    firstContentCellIndex = 1;
    if (!firstCell.source.value.trimEnd().endsWith("---")) {
      throw new Error("Expected YAML front matter to end with '---'");
    }
    // validate the YAML front matter in the document

    const lineRanges = rangedLines(firstCell.source.value.trimEnd());
    if (lineRanges.length < 3) {
      if (src.map(0)?.originalString?.fileName) {
        throw new Error(
          `${
            src.map(0)?.originalString?.fileName
          }: Expected YAML front matter to contain at least 3 lines`,
        );
      } else {
        throw new Error("Expected front matter to have at least 3 lines");
      }
    }
    const frontMatterText = mappedString(
      firstCell.source,
      [{
        start: lineRanges[1].range.start,
        end: lineRanges[lineRanges.length - 2].range.end,
      }],
    );
    const annotation = readAnnotatedYamlFromMappedString(frontMatterText)!;

    if (
      annotation.result === null ||
      !isObject(annotation.result) ||
      ((annotation.result as { [key: string]: JSONValue })["validate-yaml"] !==
        false)
    ) {
      const frontMatterSchema = await getFrontMatterSchema();

      await withValidator(frontMatterSchema, async (frontMatterValidator) => {
        const fmValidation = await frontMatterValidator.validateParseWithErrors(
          frontMatterText,
          annotation,
          "Validation of YAML front matter failed.",
          errorFn,
          reportOnce(
            (err: TidyverseError) =>
              error(tidyverseFormatError(err), { colorize: false }),
            reportSet,
          ),
        );
        if (fmValidation && fmValidation.errors.length) {
          result.push(...fmValidation.errors);
        }
      });
    }
  } else {
    firstContentCellIndex = 0;
  }

  for (const cell of nb.cells.slice(firstContentCellIndex)) {
    if (
      cell.cell_type === "markdown" ||
      cell.cell_type === "raw"
    ) {
      // not a language chunk
      continue;
    }

    const lang = cell.cell_type.language;

    try {
      const fullCell = mappedString(cell.sourceVerbatim, [{
        start: lang.length + 6,
        end: cell.sourceVerbatim.value.length - 3,
      }]);
      await partitionCellOptionsMapped(
        lang,
        fullCell,
        true,
        engine,
      );
    } catch (e) {
      if (e instanceof ValidationError) {
        error("Validation of YAML cell metadata failed.");
        for (const err of e.validationErrors) {
          console.log(tidyverseFormatError(err.niceError));
        }
        result.push(...e.validationErrors);
      } else {
        throw e;
      }
    }
  }
  return result;
}

// deno-lint-ignore require-await
export async function validateDocument(
  context: RenderContext,
): Promise<LocalizedError[]> {
  if (context.target.markdown.value === "") {
    // no markdown -> no validation.
    return [];
  }

  return validateDocumentFromSource(
    context.target.markdown,
    context.engine.name,
    error,
  );
}
