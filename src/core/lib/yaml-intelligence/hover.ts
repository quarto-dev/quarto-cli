/*
* hover.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { readAnnotatedYamlFromMappedString } from "./tree-sitter-annotated-yaml.ts";
import { breakQuartoMd, QuartoMdCell } from "../break-quarto-md.ts";
import { asMappedString } from "../mapped-text.ts";
import { kLangCommentChars } from "../partition-cell-options.ts";
import { rangedLines } from "../ranged-text.ts";
import { indexToRowCol, lines, rowColToIndex } from "../text.ts";
import { navigateSchemaByInstancePath } from "../yaml-validation/schema-navigation.ts";
import { ConcreteSchema, Schema } from "../yaml-schema/types.ts";
import { locateCursor } from "./tree-sitter-annotated-yaml.ts";
import { YamlIntelligenceContext } from "./types.ts";
import { resolveSchema } from "../yaml-validation/schema-utils.ts";
import { getFrontMatterSchema } from "../../lib/yaml-schema/front-matter.ts";
import { getEngineOptionsSchema } from "../../lib/yaml-schema/chunk-metadata.ts";
import { getProjectConfigSchema } from "../yaml-schema/project-config.ts";

// we use vscode interface here
interface Position {
  line: number;
  character: number;
}

export interface Hover {
  content: string;
  range: {
    start: Position;
    end: Position;
  };
}

export async function hover(
  context: YamlIntelligenceContext,
): Promise<Hover | null> {
  const foundCell = locateCellWithCursor(context);
  if (!foundCell) {
    return null;
  }

  const { doc: vd, schema } = await createVirtualDocument(context);

  const annotation = await readAnnotatedYamlFromMappedString(
    asMappedString(vd),
  );
  if (annotation === null) {
    // failed to produce partial parsed yaml, don't give hover info
    return null;
  }
  const offset = rowColToIndex(vd)(context.position);
  const { withError, value, kind, annotation: innerAnnotation } = locateCursor(
    annotation,
    offset,
  );

  if (withError || value === undefined || innerAnnotation === undefined) {
    return null;
  }

  const navigationPath = kind === "value" ? value.slice(0, -1) : value;

  const result: string[] = [];
  for (
    const matchingSchema of navigateSchemaByInstancePath(
      schema,
      navigationPath,
    ) as Schema[]
  ) {
    if (matchingSchema === false || matchingSchema === true) {
      continue;
    }
    const concreteSchema = resolveSchema(matchingSchema) as ConcreteSchema;
    if (concreteSchema.tags && concreteSchema.tags.description) {
      const desc = concreteSchema.tags.description as {
        short: string;
        long: string;
      } | string;
      if (typeof desc === "string") {
        result.push(desc);
      } else {
        result.push(desc.long);
      }
    }
  }

  const f = indexToRowCol(asMappedString(context.code).value);
  const start = f(innerAnnotation!.start),
    end = f(innerAnnotation!.end);

  return {
    content: result.join("\n\n"),
    range: {
      start: {
        line: start.line,
        character: start.column,
      },
      end: {
        line: end.line,
        character: end.column,
      },
    },
  };
}

export async function createVirtualDocument(
  context: YamlIntelligenceContext,
): Promise<{
  doc: string;
  schema: ConcreteSchema;
}> {
  if (context.filetype === "yaml") {
    // right now we assume this is _quarto.yml
    return {
      doc: asMappedString(context.code).value,
      schema: await getProjectConfigSchema(),
    };
  }
  const nonSpace = /[^\r\n]/g;
  const { cells } = await breakQuartoMd(asMappedString(context.code));
  const chunks = [];
  let schema: ConcreteSchema;
  for (const cell of cells) {
    const cellLines = rangedLines(cell.source.value, true);
    const size = cellLines.length;
    if (size + cell.cellStartLine > context.position.row) {
      if (cell.cell_type === "raw") {
        // cursor is in a yaml block, so we don't push the triple-tick context
        for (const { substring } of cellLines) {
          if (substring.trim() === "---") {
            chunks.push(substring.replace(nonSpace, " "));
          } else {
            chunks.push(substring);
          }
        }
        schema = await getFrontMatterSchema();
      } else if (cell.cell_type === "markdown" || cell.cell_type === "math") {
        // no yaml in a markdown block;
      } else {
        // code chunk of some kind
        schema = (await getEngineOptionsSchema())[context.engine || "markdown"];
        const commentPrefix = kLangCommentChars[cell.cell_type.language] + "| ";

        for (const { substring } of cellLines) {
          if (substring.startsWith(commentPrefix)) {
            chunks.push(
              substring.replace(
                commentPrefix,
                " ".repeat(commentPrefix.length),
              ),
            );
          } else {
            chunks.push(substring.replace(nonSpace, " "));
          }
        }
      }
      break;
    } else {
      chunks.push(cell.source.value.replace(/[^\r\n]/g, " "));
    }
  }
  return {
    doc: chunks.join(""),
    schema: schema!,
  };
}

async function locateCellWithCursor(
  context: YamlIntelligenceContext,
): Promise<QuartoMdCell | undefined> {
  const result = await breakQuartoMd(asMappedString(context.code));

  let foundCell = undefined;
  for (const cell of result.cells) {
    const size = lines(cell.source.value).length;
    if (size + cell.cellStartLine > context.position.row) {
      foundCell = cell;
      break;
    }
  }
  return foundCell;
}
