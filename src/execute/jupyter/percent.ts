/*
 * percent.ts
 *
 * Copyright (C) 2020-202 Posit Software, PBC
 */

import { extname } from "../../deno_ral/path.ts";

import { lines } from "../../core/text.ts";
import { trimEmptyLines } from "../../core/lib/text.ts";
import { Metadata } from "../../config/types.ts";
import { asYamlText } from "../../core/jupyter/jupyter-fixups.ts";
import { pandocAttrKeyvalueFromText } from "../../core/pandoc/pandoc-attr.ts";
import { kCellRawMimeType } from "../../config/constants.ts";
import { mdFormatOutput, mdRawOutput } from "../../core/jupyter/jupyter.ts";

export const kJupyterPercentScriptExtensions = [
  ".py",
  ".jl",
  ".r",
];

export function isJupyterPercentScript(file: string) {
  const ext = extname(file).toLowerCase();
  if (kJupyterPercentScriptExtensions.includes(ext)) {
    const text = Deno.readTextFileSync(file);
    return !!text.match(/^\s*#\s*%%+\s+\[markdown|raw\]/);
  } else {
    return false;
  }
}

export function markdownFromJupyterPercentScript(file: string) {
  // determine language/kernel
  const ext = extname(file).toLowerCase();
  const language = ext === ".jl" ? "julia" : ext === ".r" ? "r" : "python";

  // break into cells
  const cells: PercentCell[] = [];
  const activeCell = () => cells[cells.length - 1];
  for (const line of lines(Deno.readTextFileSync(file).trim())) {
    const header = percentCellHeader(line);
    if (header) {
      cells.push({ header, lines: [] });
    } else {
      activeCell()?.lines.push(line);
    }
  }

  // resolve markdown and raw cells
  const isTripleQuote = (line: string) => !!line.match(/^"{3,}\s*$/);
  const asCell = (lines: string[]) => lines.join("\n") + "\n\n";
  const stripPrefix = (line: string) => line.replace(/^#\s?/, "");
  const cellContent = (cellLines: string[]) => {
    if (
      cellLines.length > 2 && isTripleQuote(cellLines[0]) &&
      isTripleQuote(cellLines[cellLines.length - 1])
    ) {
      return asCell(cellLines.slice(1, cellLines.length - 1));
    } else {
      // commented
      return asCell(cellLines.map(stripPrefix));
    }
  };

  return cells.reduce((markdown, cell) => {
    const cellLines = trimEmptyLines(cell.lines);
    if (cell.header.type === "code") {
      if (cell.header.metadata) {
        const yamlText = asYamlText(cell.header.metadata);
        cellLines.unshift(...lines(yamlText).map((line) => `#| ${line}`));
      }
      markdown += asCell(["```{" + language + "}", ...cellLines, "```"]);
    } else if (cell.header.type === "markdown") {
      markdown += cellContent(cellLines);
    } else if (cell.header.type == "raw") {
      let rawContent = cellContent(cellLines);
      const format = cell.header?.metadata?.["format"];
      const mimeType = cell.header.metadata?.[kCellRawMimeType];
      if (typeof (mimeType) === "string") {
        const rawBlock = mdRawOutput(mimeType, lines(rawContent));
        rawContent = rawBlock || rawContent;
      } else if (typeof (format) === "string") {
        rawContent = mdFormatOutput(format, lines(rawContent));
      }
      markdown += rawContent;
    }
    return markdown;
  }, "");
}

interface PercentCell {
  header: PercentCellHeader;
  lines: string[];
}

interface PercentCellHeader {
  type: "code" | "raw" | "markdown";
  metadata?: Metadata;
}

function percentCellHeader(line: string): PercentCellHeader | undefined {
  const match = line.match(
    /^\s*#\s*%%+\s*(?:\[(markdown|raw)\])?\s*(.*)?$/,
  );
  if (match) {
    const type = match[1] || "code";
    const attribs = match[2] || "";
    if (["code", "raw", "markdown"].includes(type)) {
      return {
        type,
        metadata: parsePercentAttribs(attribs),
      } as PercentCellHeader;
    } else {
      throw new Error(`Invalid cell type: ${type}`);
    }
  }
}

function parsePercentAttribs(
  attribs: string,
): Metadata | undefined {
  // skip over title
  const match = attribs.match(/[\w\-]+=.*$/);
  if (match) {
    const keyValue = pandocAttrKeyvalueFromText(match[0], " ");
    const metadata: Metadata = {};
    keyValue.forEach((value) => {
      metadata[value[0]] = value[1];
    });
    return metadata;
  }
}
