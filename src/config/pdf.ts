// union of metadata and command line flags which determine
import { FormatPandoc } from "./format.ts";
import { PandocFlags } from "./flags.ts";

// the requested pdf engine, it's options, and the bib engine
export interface PdfEngine {
  pdfEngine: string;
  pdfEngineOpts?: string[];
  bibEngine?: "natbib" | "biblatex";
}

export function pdfEngine(
  defaults?: FormatPandoc,
  flags?: PandocFlags,
): PdfEngine {
  // provide for misssing defaults
  defaults = defaults || {};

  // determine pdfengine
  const pdfEngine =
    (flags?.pdfEngine || defaults["pdf-engine"] as string || "pdflatex");

  // collect all engine opts
  const pdfEngineOpts = (defaults["pdf-engine-opts"] as string[] || []);
  if (defaults["pdf-engine-opt"]) {
    pdfEngineOpts.push(defaults["pdf-engine-opt"] as string);
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
      : defaults["cite-method"] === "natbib"
      ? "natbib"
      : defaults["cite-method"] == "biblatex"
      ? "biblatex"
      : undefined,
  };
}
