/*
 * latexmk.ts
 *
 * Copyright (C) 2020 by RStudio, PBC
 *
 */

import { dirname, isAbsolute, join, normalize, relative } from "path/mod.ts";
import { ensureDirSync } from "fs/mod.ts";

import { writeFileToStdout } from "../../../core/console.ts";
import { dirAndStem, expandPath } from "../../../core/path.ts";
import { texSafeFilename } from "../../../core/tex.ts";

import {
  kKeepTex,
  kLatexAutoInstall,
  kLatexAutoMk,
  kLatexClean,
  kLatexMaxRuns,
  kLatexMinRuns,
  kLatexOutputDir,
  kOutputExt,
  kOutputFile,
} from "../../../config/constants.ts";
import { Format } from "../../../config/types.ts";
import { isLatexPdfEngine, pdfEngine } from "../../../config/pdf.ts";

import { PandocOptions, RenderFlags, RenderOptions } from "../types.ts";
import { kStdOut, replacePandocOutputArg } from "../flags.ts";
import { OutputRecipe } from "../types.ts";
import { generatePdf } from "./pdf.ts";
import { LatexmkOptions } from "./types.ts";

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
  // break apart input file
  const [inputDir, inputStem] = dirAndStem(input);

  // there are many characters that give tex trouble in filenames, create
  // a target stem that replaces them with the '-' character
  const texStem = texSafeFilename(inputStem);

  // cacluate output and args for pandoc (this is an intermediate file
  // which we will then compile to a pdf and rename to .tex)
  const output = texStem + ".tex";
  let args = options.pandocArgs || [];
  const pandoc = { ...format.pandoc };
  if (options.flags?.output) {
    args = replacePandocOutputArg(args, output);
  } else {
    pandoc[kOutputFile] = output;
  }

  // The directory for PDF output
  const outputDir = format.render[kLatexOutputDir];

  // when pandoc is done, we need to run latexmk and then copy the
  // ouptut to the user's requested destination
  const complete = async (pandocOptions: PandocOptions) => {
    // determine latexmk options
    const mkOptions: LatexmkOptions = {
      input: join(inputDir, output),
      engine: pdfEngine(format.pandoc, format.render, pandocOptions.flags),
      autoInstall: format.render[kLatexAutoInstall],
      autoMk: format.render[kLatexAutoMk],
      minRuns: format.render[kLatexMinRuns],
      maxRuns: format.render[kLatexMaxRuns],
      outputDir: outputDir === null ? undefined : outputDir,
      clean: !options.flags?.debug && format.render[kLatexClean] !== false,
      quiet: pandocOptions.flags?.quiet,
    };

    // run latexmk
    const pdfOutput = await generatePdf(mkOptions);

    // keep tex if requested
    const compileTex = join(inputDir, output);
    if (!format.render[kKeepTex]) {
      Deno.removeSync(compileTex);
    }

    const normalizePath = (input: string, output: string) => {
      if (isAbsolute(output)) {
        return output;
      } else {
        return relative(
          Deno.realPathSync(dirname(input)),
          Deno.realPathSync(output),
        );
      }
    };

    // copy (or write for stdout) compiled pdf to final output location
    if (finalOutput) {
      if (finalOutput === kStdOut) {
        writeFileToStdout(pdfOutput);
        Deno.removeSync(pdfOutput);
      } else {
        const outputPdf = expandPath(finalOutput);

        if (normalize(pdfOutput) !== normalize(outputPdf)) {
          // ensure the target directory exists
          ensureDirSync(dirname(outputPdf));

          Deno.renameSync(pdfOutput, outputPdf);
        }
      }

      // Clean the output directory if it is empty
      if (outputDir) {
        try {
          // Remove the outputDir if it is empty
          Deno.removeSync(outputDir, { recursive: false });
        } catch {
          // This is ok, just means the directory wasn't empty
        }
      }

      // final output needs to either absolute or input dir relative
      // (however it may be working dir relative when it is passed in)
      return normalizePath(input, finalOutput);
    } else {
      return normalizePath(input, pdfOutput);
    }
  };

  // tweak writer if it's pdf
  const to = format.pandoc.to === "pdf" ? "latex" : format.pandoc.to;

  // return recipe
  return {
    output,
    args,
    format: {
      ...format,
      pandoc: {
        ...pandoc,
        to,
      },
    },
    complete,
  };
}
