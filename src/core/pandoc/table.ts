/*
 * table.ts
 *
 * Helpers for creating Pandoc AST tables from JS objects
 *
 * Copyright (C) 2025 Posit Software, PBC
 */

import * as Pandoc from "./json.ts";

export const fromObjects = (
  objects: Record<string, Pandoc.Block[]>[],
  keys?: string[],
  colSpecs?: Pandoc.ColSpec[],
): Pandoc.Table => {
  if (keys === undefined) {
    keys = Object.keys(objects[0]);
  }
  const header = Pandoc.tableHead([
    Pandoc.tableRow(
      keys.map((key) => Pandoc.tableCell([Pandoc.plain([Pandoc.str(key)])])),
    ),
  ]);
  const result = Pandoc.table(
    Pandoc.caption([]),
    colSpecs ?? keys.map((_) => Pandoc.colspec("AlignLeft", "ColWidthDefault")),
    header,
    [Pandoc.tableBody(
      objects.map((object) =>
        Pandoc.tableRow(keys.map((key) => {
          const value = object[key];
          return Pandoc.tableCell(value, "AlignLeft");
        }))
      ),
    )],
  );
  return result;
};
