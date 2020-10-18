// union of metadata and command line flags which determine
import { PandocFlags } from "./flags.ts";
import { Metadata } from "./metadata.ts";

// the requested pdf engine, it's options, and the bib engine
export interface PdfEngine {
  pdfEngine: string;
  pdfEngineOpts?: string[];
  bibEngine?: "natbib" | "biblatex";
}

export function pdfEngine(
  metadata: Metadata,
  flags?: PandocFlags,
): PdfEngine {
  // determine pdfengine
  const pdfEngine =
    (flags?.pdfEngine || metadata["pdf-engine"] as string || "pdflatex");

  // collect all engine opts
  const pdfEngineOpts = (metadata["pdf-engine-opts"] as string[] || []);
  if (metadata["pdf-engine-opt"]) {
    pdfEngineOpts.push(metadata["pdf-engine-opt"] as string);
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
      : metadata["cite-method"] === "natbib"
      ? "natbib"
      : metadata["cite-method"] == "biblatex"
      ? "biblatex"
      : undefined,
  };
}
