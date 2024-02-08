/*
 * verify-snapshot.ts
 *
 * Copyright (C) 2024 Posit Software, PBC
 */

import { extname } from "path/mod.ts";
import { normalizeNewlines } from "../src/core/text.ts";

type Canonicalizer = (text: string) => string;

const ipynbCanonicalizer = (text: string) => {
  const json = JSON.parse(text);
  for (const cell of json.cells) {
    if (cell.id.match(/^[0-9a-f-]+$/)) {
      cell.id = "<uuid>";
    }
  }
  return JSON.stringify(json, null, 2);
}

const canonicalizers: Record<string, Canonicalizer> = {
  "ipynb": ipynbCanonicalizer,
};

const readAndNormalizeNewlines = (file: string) => {
  return normalizeNewlines(Deno.readTextFileSync(file));
}

export const canonicalizeSnapshot = async (file: string) => {
  const ext = extname(file).slice(1);
  const canonicalizer = canonicalizers[ext] || readAndNormalizeNewlines;
  return canonicalizer(file);
}

export const checkSnapshot = async (file: string) => {
  const outputCanonical = await canonicalizeSnapshot(file);
  const snapshotCanonical = await canonicalizeSnapshot(file + ".snapshot");
  return outputCanonical === snapshotCanonical;
}
