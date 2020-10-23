// union of metadata and command line flags which determine
import { FormatPandoc } from "./format.ts";
import { PandocFlags } from "./flags.ts";
import {
  kCiteMethod,
  kPdfEngine,
  kPdfEngineOpt,
  kPdfEngineOpts,
} from "./constants.ts";

// the requested pdf engine, it's options, and the bib engine
export interface PdfEngine {
  pdfEngine: string;
  pdfEngineOpts?: string[];
  bibEngine?: "natbib" | "biblatex";
}

export function pdfEngine(
  defaults: FormatPandoc,
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

  return {
    pdfEngine,
    pdfEngineOpts,
    bibEngine: flags?.natbib
      ? "natbib"
      : flags?.biblatex
      ? "biblatex"
      : defaults[kCiteMethod] === "natbib"
      ? "natbib"
      : defaults[kCiteMethod] == "biblatex"
      ? "biblatex"
      : undefined,
  };
}
