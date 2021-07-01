/*
* keepsource.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Document, Element } from "deno_dom/deno-dom-wasm.ts";

import { kCodeTools, kKeepSource } from "../../config/constants.ts";
import { Format, isHtmlOutput } from "../../config/format.ts";
import {
  ExecutionEngine,
  executionEngineCanKeepSource,
  ExecutionTarget,
} from "../../execute/engine.ts";
import { kMarkdownBlockSeparator } from "./pandoc.ts";

const kKeepSourceId = "quarto-embedded-source-code";
const kKeepSourceSentinel = "quarto-executable-code-5450563D";

export function resolveKeepSource(
  format: Format,
  engine: ExecutionEngine,
  target: ExecutionTarget,
) {
  // keep source if requested (via keep-source or code-tools), we are targeting html,
  // and engine can keep it (e.g. we wouldn't keep an .ipynb file as source)
  const codeTools = format.render?.[kCodeTools];
  if (
    codeTools === true ||
    (typeof (codeTools) === "object" && codeTools?.source !== false)
  ) {
    format.render[kKeepSource] = true;
  }
  format.render[kKeepSource] = format.render[kKeepSource] &&
    isHtmlOutput(format.pandoc, true) &&
    executionEngineCanKeepSource(engine, target);
}

export function keepSourceBlock(format: Format, source: string) {
  if (format.render[kKeepSource]) {
    // read code
    let code = Deno.readTextFileSync(source).trimLeft();
    if (!code.endsWith("\n")) {
      code = code + "\n";
    }

    // make sure that quarto code blocks get correct highlighting
    code = code.replaceAll(
      /\n```{(\w+)}\s*\n/g,
      "\n" + kKeepSourceSentinel + "\n\n```$1\n",
    );

    const kKeepSourceBackticks = "```````````````";
    return `${kMarkdownBlockSeparator}${kKeepSourceBackticks}` +
      `{#${kKeepSourceId} .markdown}\n${code}` +
      `${kKeepSourceBackticks}\n`;
  } else {
    return "";
  }
}

export function keepSourcePostprocessor(doc: Document): Promise<string[]> {
  const lines = doc.querySelectorAll(
    `#${kKeepSourceId} > pre > code > span`,
  );
  if (lines.length > 0) {
    const newLines: Element[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] as Element;
      if (line.innerText === kKeepSourceSentinel) {
        i += 2;
        const codeBlockLine = lines[i] as Element;
        const codeSpan = codeBlockLine.lastChild as Element;
        codeSpan.innerHTML = codeSpan.innerHTML.replace(/```(\w+)/, "```{$1}");
        newLines.push(codeBlockLine);
      } else {
        newLines.push(line);
      }
    }
    if (newLines.length !== lines.length) {
      const parent = (lines[0] as Element).parentElement!;
      parent.innerHTML = "";
      newLines.forEach((line) => {
        parent.appendChild(line);
        parent.appendChild(doc.createTextNode("\n"));
      });
    }
  }

  return Promise.resolve([]);
}
