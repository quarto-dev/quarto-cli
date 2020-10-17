/*
 * tinytex.ts
 *
 * Copyright (C) 2020 by RStudio, PBC
 *
 * Unless you have received this program directly from RStudio pursuant
 * to the terms of a commercial license agreement with RStudio, then
 * this program is licensed to you under the terms of version 3 of the
 * GNU General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * GPL (http://www.gnu.org/licenses/gpl-3.0.txt) for more details.
 *
 */

import { basename, join } from "path/mod.ts";

import { Format } from "../../api/format.ts";

import { writeFileToStdout } from "../../core/console.ts";
import { dirAndStem, removeIfExists } from "../../core/path.ts";
import { execProcess, ProcessResult } from "../../core/process.ts";

import { TinytexConfig } from "../../config/metadata.ts";

import {
  pandocMetadata,
  PandocOptions,
  PdfEngine,
  pdfEngine,
} from "./pandoc.ts";
import { RenderOptions } from "./render.ts";
import { kStdOut, RenderFlags, replacePandocArg } from "./flags.ts";
import { OutputRecipe } from "./output.ts";

export function useTinyTex(input: string, format: Format, flags?: RenderFlags) {
  // check writer and extension
  const writer = format.pandoc?.writer;
  const ext = format.output?.ext || "html";

  // if we are creating pdf output
  if (["beamer", "pdf"].includes(writer || "") && ext === "pdf") {
    // and we are using one of the engines supported by tinytex
    const metadata = pandocMetadata(input, format.pandoc);
    const engine = pdfEngine(metadata, flags);
    return ["pdflatex", "xelatex", "lualatex"].includes(
      engine.pdfEngine,
    );
  }

  // default to false
  return false;
}

export function tinyTexOutputRecipe(
  options: RenderOptions,
  format: Format,
): OutputRecipe {
  // break apart input file
  const [inputDir, inputStem] = dirAndStem(options.input);

  // there are many characters that give tex trouble in filenames, create
  // a target stem that replaces them with the '-' character
  const safeInputStem = inputStem.replaceAll(/[ <>()|\:&;#?*']/g, "-");

  // cacluate output and args for pandoc (this is an intermediate file
  // which we will then compile to a pdf and rename to .tex)
  const output = safeInputStem + ".quarto.tex";
  const args = replacePandocArg(options.pandocArgs || [], "--output", output);

  // when pandoc is done, we need to run tinytex and then copy the
  // ouptut to the user's requested destination
  const complete = async (pandocOptions: PandocOptions) => {
    // compute texStem
    const texStem = basename(output, ".tex");

    // determine tinytex options
    const metadata = pandocMetadata(pandocOptions.input, pandocOptions.format);
    const ttOptions: TinytexOptions = {
      input: join(inputDir, output),
      output: texStem + ".pdf",
      pdfEngine: pdfEngine(metadata, pandocOptions.flags),
      config: metadata.tinytex,
    };

    // run tinytex
    const result = await runTinytex(ttOptions);
    if (!result.success) {
      return Promise.reject();
    }

    // keep tex if requested
    const compileTex = join(inputDir, output);
    const outputTex = join(inputDir, safeInputStem + ".tex");
    if (options.flags?.keepAll || format.keep?.tex) {
      Deno.renameSync(compileTex, outputTex);
    } else {
      Deno.removeSync(compileTex);
      removeIfExists(outputTex); // from previous renders
    }

    // copy (or write for stdout) compiled pdf to final output location
    const compilePdf = join(inputDir, texStem + ".pdf");
    let finalOutput = options.flags?.output;
    if (!finalOutput) {
      // no output specified on command line, write alongside input
      finalOutput = join(inputDir, safeInputStem + ".pdf");
      Deno.renameSync(compilePdf, finalOutput);
    } else if (finalOutput === kStdOut) {
      // stdout specified on the command line
      writeFileToStdout(compilePdf);
      Deno.removeSync(compilePdf);
    } else {
      // some other explicit path specified on the command line
      Deno.renameSync(compilePdf, finalOutput);
    }

    // return path to file we ultimately created (for printing to user)
    return finalOutput;
  };

  // tweak writer if it's pdf
  const writer = format.pandoc?.writer === "pdf"
    ? "latex"
    : format.pandoc?.writer;

  // return recipe
  return {
    output,
    args,
    pandoc: {
      writer,
    },
    complete,
  };
}

interface TinytexOptions {
  input: string;
  output?: string; // default: input.pdf
  pdfEngine?: PdfEngine; // default: pdflatex
  config?: TinytexConfig;
}

async function runTinytex(
  options: TinytexOptions,
): Promise<ProcessResult> {
  // provide argument defaults
  const {
    input,
    pdfEngine = { pdfEngine: "pdflatex" },
  } = options;
  const [inputDir, inputStem] = dirAndStem(input);
  const output = options.output ? options.output : join(inputStem + ".pdf");
  const config = options.config || {};
  const { install = true, clean = true } = config;
  const minTimes = typeof config["min-times"] === "number"
    ? config["min-times"]
    : 1;
  const maxTimes = typeof config["max-times"] === "number"
    ? config["max-times"]
    : 10;

  // run
  const result = await execProcess({
    cmd: [
      "pdflatex",
      "-halt-on-error",
      "-interaction=batchmode",
      basename(input),
    ],
    cwd: inputDir,
  });
  if (!result.success) {
    return Promise.reject();
  }

  // cleanup intermediates
  ["toc", "out", "aux", "log"].forEach((ext) => {
    removeIfExists(join(inputDir, inputStem + "." + ext));
  });

  return result;
}

function auxFile(stem: string, ext: string) {
  return `${stem}.${ext}`;
}

function cleanup(input: string, pdfEngineOpts: string[]) {
  const [inputDir, inputStem] = dirAndStem(input);
  const auxFiles = [
    "log",
    "idx",
    "aux",
    "bcf",
    "blg",
    "bbl",
    "fls",
    "out",
    "lof",
    "lot",
    "toc",
    "nav",
    "snm",
    "vrb",
    "ilg",
    "ind",
    "xwm",
    "brf",
    "run.xml",
  ].map((aux) => join(inputDir, auxFile(inputStem, aux)));
}
