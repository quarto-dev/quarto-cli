/*
 * verify-snapshot.ts
 *
 * Copyright (C) 2024 Posit Software, PBC
 */

import { extname } from "path/mod.ts";
import { normalizeNewlines } from "../src/core/text.ts";
import { withDocxContent } from "./verify.ts";

import * as slimdom from "slimdom";
import xpath from "fontoxpath";

type Canonicalizer = (text: string) => Promise<string>;

const ipynbCanonicalizer = (text: string) => {
  const json = JSON.parse(text);
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
  if (file.endsWith(".snapshot")) {
    file = file.slice(0, -9);
  }
  let ext = extname(file).slice(1);
  const canonicalizer = canonicalizers[ext] || readAndNormalizeNewlines;
  return canonicalizer(file);
}

export const checkSnapshot = async (file: string) => {
  const outputCanonical = await canonicalizeSnapshot(file);
  const snapshotCanonical = await canonicalizeSnapshot(file + ".snapshot");
  return outputCanonical === snapshotCanonical;
}
