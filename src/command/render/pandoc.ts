import { basename, dirname } from "path/mod.ts";
import { stringify } from "encoding/yaml.ts";

import type { FormatPandoc } from "../../api/format.ts";
import { execProcess, ProcessResult } from "../../core/process.ts";
import { consoleWriteLine } from "../../core/console.ts";
import { Metadata, metadataFromFile } from "../../config/metadata.ts";
import { mergeConfigs } from "../../config/config.ts";
import { RenderFlags } from "./flags.ts";

export interface PandocOptions {
  input: string;
  format: FormatPandoc;
  args: string[];
  flags?: RenderFlags;
  quiet?: boolean;
}

export async function runPandoc(
  options: PandocOptions,
): Promise<ProcessResult> {
  // build the pandoc command
  const cmd = ["pandoc", basename(options.input)];

  // write a temporary default file from the options
  const yaml = "---\n" + stringify(options.format);
  const yamlFile = await Deno.makeTempFile(
    { prefix: "quarto-defaults", suffix: ".yml" },
  );
  await Deno.writeTextFile(yamlFile, yaml);
  cmd.push("--defaults", yamlFile);

  // add citeproc if necessary
  const citeproc = citeMethod(options) === "citeproc";
  if (citeproc) {
    cmd.push("--citeproc");
  }

  // add user command line args
  cmd.push(...options.args);

  // print defaults file and command line args
  if (!options.quiet) {
    if (options.args.length > 0) {
      consoleWriteLine(yaml + "args: " + options.args.join(" "));
    } else {
      consoleWriteLine(yaml);
    }
    consoleWriteLine("---\n");
  }

  // run pandoc
  return await execProcess({
    cmd,
    cwd: dirname(options.input),
  });
}

export type CiteMethod = "citeproc" | "natbib" | "biblatex";

export function citeMethod(
  options: PandocOptions,
): CiteMethod | null {
  // collect config
  const metadata = pandocMetadata(options);
  const pdf = pdfEngine(metadata, options.flags);

  // no handler if no references
  if (!metadata.bibliography && !metadata.references) {
    return null;
  }

  // if it's pdf-based output check for natbib or biblatex
  if (pdf?.bibEngine) {
    return pdf.bibEngine;
  }

  // otherwise it's citeproc unless expressly disabled
  if (metadata.citeproc !== false) {
    return "citeproc";
  } else {
    return null;
  }
}

export interface PdfEngine {
  pdfEngine: string;
  pdfEngineOpts?: string[];
  bibEngine?: "natbib" | "biblatex";
}

export function pdfEngine(
  metadata: Metadata,
  flags?: RenderFlags,
): PdfEngine | undefined {
  // collect all engine opts
  const pdfEngineOpts = (metadata["pdf-engine-opts"] as string[] || []);
  if (metadata["pdf-engine-opt"]) {
    pdfEngineOpts.push(metadata["pdf-engine-opt"] as string);
  }
  if (flags?.pdfEngineOpts) {
    pdfEngineOpts.push(...flags?.pdfEngineOpts);
  }

  return {
    pdfEngine: flags?.pdfEngine || metadata["pdf-engine"] as string ||
      "pdflatex",
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

export function pandocMetadata(
  options: PandocOptions,
): Metadata {
  // get all metadata from the input file
  const inputMetadata = metadataFromFile(options.input);

  // derive 'final' metadata by merging the intputMetadata intot the format definition
  return mergeConfigs(options.format, inputMetadata);
}
