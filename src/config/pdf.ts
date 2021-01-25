// union of metadata and command line flags which determine
import { FormatPandoc, FormatRender } from "./format.ts";
import { PandocFlags } from "./flags.ts";
import {
  kCiteMethod,
  kLatexMakeIndex,
  kLatexMakeIndexOpts,
  kLatexTlmgrOpts,
  kPdfEngine,
  kPdfEngineOpt,
  kPdfEngineOpts,
} from "./constants.ts";

// the requested pdf engine, it's options, and the bib engine
export interface PdfEngine {
  pdfEngine: string;
  pdfEngineOpts?: string[];
  bibEngine?: "natbib" | "biblatex";
  indexEngine?: string;
  indexEngineOpts?: string[];
  tlmgrOpts?: string[];
}

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

  // index options
  const indexEngine = render[kLatexMakeIndex];
  const indexEngineOpts = render[kLatexMakeIndexOpts];

  // tlmgr options
  const tlmgrOpts = render[kLatexTlmgrOpts];

  // collect all engine opts
  const pdfEngineOpts = defaults[kPdfEngineOpts] || [];
  if (defaults[kPdfEngineOpt]) {
    pdfEngineOpts.push(defaults[kPdfEngineOpt] as string);
  }
  if (flags?.pdfEngineOpts) {
    pdfEngineOpts.push(...flags?.pdfEngineOpts);
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
