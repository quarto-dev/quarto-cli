/*
* pdf.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

// union of metadata and command line flags which determine
import { FormatPandoc, FormatRender, PandocFlags, PdfEngine } from "./types.ts";
import {
  kCiteMethod,
  kLatexMakeIndex,
  kLatexMakeIndexOpts,
  kLatexTlmgrOpts,
  kPdfEngine,
  kPdfEngineOpt,
  kPdfEngineOpts,
} from "./constants.ts";

export function bibEngine(defaults: FormatPandoc, flags?: PandocFlags) {
  return flags?.natbib
    ? "natbib"
    : flags?.biblatex
    ? "biblatex"
    : defaults[kCiteMethod] === "natbib"
    ? "natbib"
    : defaults[kCiteMethod] == "biblatex"
    ? "biblatex"
    : undefined;
}

export function pdfEngine(
  defaults: FormatPandoc,
  render: FormatRender,
  flags?: PandocFlags,
): PdfEngine {
  // determine pdfengine
  const pdfEngine =
    (flags?.pdfEngine || defaults[kPdfEngine] as string || "pdflatex");

  // collect all engine opts
  const pdfEngineOpts = defaults[kPdfEngineOpts] || [];
  if (defaults[kPdfEngineOpt]) {
    pdfEngineOpts.push(defaults[kPdfEngineOpt] as string);
  }
  if (flags?.pdfEngineOpts) {
    pdfEngineOpts.push(...flags?.pdfEngineOpts);
  }

  // index options
  const indexEngine = render[kLatexMakeIndex];
  const indexEngineOpts = render[kLatexMakeIndexOpts] || [];
  if (flags?.makeIndexOpts) {
    indexEngineOpts?.push(...flags?.makeIndexOpts);
  }

  // tlmgr options
  const tlmgrOpts = render[kLatexTlmgrOpts] || [];
  if (flags?.tlmgrOpts) {
    tlmgrOpts?.push(...flags?.tlmgrOpts);
  }

  return {
    pdfEngine,
    pdfEngineOpts,
    bibEngine: bibEngine(defaults, flags),
    indexEngine,
    indexEngineOpts,
    tlmgrOpts,
  };
}

export function isLatexPdfEngine(engine: PdfEngine) {
  return ["pdflatex", "xelatex", "lualatex", "latexmk"].includes(
    engine.pdfEngine,
  );
}
