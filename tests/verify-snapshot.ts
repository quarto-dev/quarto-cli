/*
 * verify-snapshot.ts
 *
 * Copyright (C) 2024 Posit Software, PBC
 */

import { extname } from "../src/deno_ral/path.ts";
import { normalizeNewlines } from "../src/core/text.ts";
import { withDocxContent } from "./verify.ts";
import { createPatch, diffWordsWithSpace, diffChars } from "../src/core/lib/external/diff.js";

import * as slimdom from "slimdom";
import xpath from "fontoxpath";

type Canonicalizer = (file: string) => Promise<string>;

const ipynbCanonicalizer = (file: string) => {
  const json = JSON.parse(Deno.readTextFileSync(file));
  for (const cell of json.cells) {
    if (cell.id.match(/^[0-9a-f-]+$/)) {
      cell.id = "<uuid>";
    }
  }
  return Promise.resolve(JSON.stringify(json, null, 2));
}

const docxCanonicalizer = async (fileName: string) => {
  return withDocxContent(fileName, async (content) => {
    const xmlDoc = slimdom.parseXmlDocument(content);
    for await (const element of xpath.evaluateXPathToAsyncIterator("//pic:cNvPr", xmlDoc)) {
      element.setAttribute("descr", "<uuid>");
    }
    return slimdom.serializeToWellFormedString(xmlDoc);
  });
}

const canonicalizers: Record<string, Canonicalizer> = {
  "ipynb": ipynbCanonicalizer,
  "docx": docxCanonicalizer,
};

const readAndNormalizeNewlines = (file: string) => {
  return normalizeNewlines(Deno.readTextFileSync(file));
}

export const canonicalizeSnapshot = async (file: string) => {
  const origFile = file;
  if (file.endsWith(".snapshot")) {
    file = file.slice(0, -9);
  }
  let ext = extname(file).slice(1);
  const canonicalizer = canonicalizers[ext] || readAndNormalizeNewlines;
  return canonicalizer(origFile);
}

export const checkSnapshot = async (file: string) => {
  const outputCanonical = await canonicalizeSnapshot(file);
  const snapshotCanonical = await canonicalizeSnapshot(file + ".snapshot");
  return outputCanonical === snapshotCanonical;
}

export const generateSnapshotDiff = async (file: string): Promise<string> => {
  const outputCanonical = await canonicalizeSnapshot(file);
  const snapshotCanonical = await canonicalizeSnapshot(file + ".snapshot");
  return createPatch(
    file + ".snapshot",
    snapshotCanonical,
    outputCanonical,
    "expected",
    "actual"
  );
}

export type WordDiffPart = { value: string; added?: boolean; removed?: boolean };

export const generateInlineDiff = async (file: string): Promise<WordDiffPart[]> => {
  const outputCanonical = await canonicalizeSnapshot(file);
  const snapshotCanonical = await canonicalizeSnapshot(file + ".snapshot");

  const stripWhitespace = (s: string) => s.replace(/\s+/g, "");
  const isWhitespaceOnlyChange = stripWhitespace(outputCanonical) === stripWhitespace(snapshotCanonical);

  if (isWhitespaceOnlyChange) {
    return diffChars(snapshotCanonical, outputCanonical);
  }

  return diffWordsWithSpace(snapshotCanonical, outputCanonical);
}
