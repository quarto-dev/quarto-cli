/*
 * latexmk.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import {
  kLatexAutoInstall,
  kLatexAutoMk,
  kLatexClean,
  kLatexInputPaths,
  kLatexMaxRuns,
  kLatexMinRuns,
  kLatexOutputDir,
  kLatexTinyTex,
  kOutputExt,
} from "../../../config/constants.ts";
import { Format } from "../../../config/types.ts";
import { isLatexPdfEngine, pdfEngine } from "../../../config/pdf.ts";

import { PandocOptions, RenderFlags, RenderOptions } from "../types.ts";
import { OutputRecipe } from "../types.ts";
import { generatePdf } from "./pdf.ts";
import { LatexmkOptions } from "./types.ts";
import { texToPdfOutputRecipe } from "../output-tex.ts";
import { join } from "path/mod.ts";
import { dirAndStem } from "../../../core/path.ts";

export function useQuartoLatexmk(
  format: Format,
  flags?: RenderFlags,
) {
  // check writer and extension
  const to = format.pandoc.to;
  const ext = format.render[kOutputExt] || "html";

  // Check whether explicitly disabled
  if (format.render[kLatexAutoMk] === false) {
    return false;
  }

  // if we are creating pdf output
  if (["beamer", "pdf"].includes(to || "") && ext === "pdf") {
    const engine = pdfEngine(format.pandoc, format.render, flags);
    return isLatexPdfEngine(engine);
  }

  // default to false
  return false;
}

export function quartoLatexmkOutputRecipe(
  input: string,
  finalOutput: string,
  options: RenderOptions,
  format: Format,
): OutputRecipe {
  // output dir
  const outputDir = format.render[kLatexOutputDir];

  const generate = (
    input: string,
    format: Format,
    pandocOptions: PandocOptions,
  ): Promise<string> => {
    // Resolve any tex input paths
    const texInputDirs: string[] = [];
    if (format.render[kLatexInputPaths]) {
      texInputDirs.push(...format.render[kLatexInputPaths]!);
    }

    // determine latexmk options
    const mkOptions: LatexmkOptions = {
      input,
      engine: pdfEngine(format.pandoc, format.render, pandocOptions.flags),
      autoInstall: format.render[kLatexAutoInstall],
      autoMk: format.render[kLatexAutoMk],
      minRuns: format.render[kLatexMinRuns],
      maxRuns: format.render[kLatexMaxRuns],
      tinyTex: format.render[kLatexTinyTex],
      texInputDirs,
      outputDir: outputDir === null ? undefined : outputDir,
      clean: !options.flags?.debug && format.render[kLatexClean] !== false,
      quiet: pandocOptions.flags?.quiet,
    };

    // run latexmk
    return generatePdf(mkOptions);
  };

  const computePath = (texStem: string, inputDir: string, format: Format) => {
    const mkOutputdir = format.render[kLatexOutputDir];
    return mkOutputdir
      ? join(mkOutputdir, texStem + ".pdf")
      : join(inputDir, texStem + ".pdf");
  };

  return texToPdfOutputRecipe(
    input,
    finalOutput,
    options,
    format,
    "latex",
    {
      generate,
      computePath,
    },
    outputDir,
  );
}
