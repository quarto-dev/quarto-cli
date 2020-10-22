/*
 * latexmk.ts
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

import { basename, dirname, join, normalize } from "path/mod.ts";

import { writeFileToStdout } from "../../core/console.ts";
import { dirAndStem, expandPath } from "../../core/path.ts";
import { execProcess, ProcessResult } from "../../core/process.ts";

import { kKeepTex, kOutputExt } from "../../config/constants.ts";
import { Format } from "../../config/config.ts";
import { pdfEngine } from "../../config/pdf.ts";

import { LatexmkOptions } from "../../computation/engine.ts";

import { PandocOptions } from "./pandoc.ts";
import { RenderOptions } from "./render.ts";
import {
  kStdOut,
  removePandocArgs,
  RenderFlags,
  replacePandocArg,
} from "./flags.ts";
import { OutputRecipe } from "./output.ts";

export function useLatexmk(input: string, format: Format, flags?: RenderFlags) {
  // check writer and extension
  const to = format.defaults?.to;
  const ext = format?.[kOutputExt] || "html";

  // if we are creating pdf output
  if (["beamer", "pdf"].includes(to || "") && ext === "pdf") {
    // and we are using one of the engines supported by latexmk
    const metadata = {};
    const engine = pdfEngine(metadata, flags);
    return ["pdflatex", "xelatex", "lualatex"].includes(
      engine.pdfEngine,
    );
  }

  // default to false
  return false;
}

export function latexmkOutputRecipe(
  options: RenderOptions,
  format: Format,
  latexmk?: (options: LatexmkOptions) => Promise<void>,
): OutputRecipe {
  // provide default latexmk if necessary
  const latexmkHandler = latexmk ? latexmk : runLatexmk;

  // break apart input file
  const [inputDir, inputStem] = dirAndStem(options.input);

  // there are many characters that give tex trouble in filenames, create
  // a target stem that replaces them with the '-' character
  const texStem = inputStem.replaceAll(/[ <>()|\:&;#?*']/g, "-");

  // cacluate output and args for pandoc (this is an intermediate file
  // which we will then compile to a pdf and rename to .tex)
  const output = texStem + ".tex";
  let args = replacePandocArg(options.pandocArgs || [], "--output", output);

  // remove --to argument if it's there, since we've already folded it
  // into the yaml, and it will be "beamer" or "pdf" so actually incorrect
  const removeArgs = new Map<string, boolean>();
  removeArgs.set("--to", true);
  args = removePandocArgs(args, removeArgs);

  // when pandoc is done, we need to run latexmk and then copy the
  // ouptut to the user's requested destination
  const complete = async (pandocOptions: PandocOptions) => {
    // determine latexmk options
    const metadata = {};
    const mkOptions: LatexmkOptions = {
      input: join(inputDir, output),
      engine: pdfEngine(metadata, pandocOptions.flags),
      clean: !options.flags?.debug,
      quiet: pandocOptions.flags?.quiet,
    };

    // run latexmk
    await latexmkHandler(mkOptions);

    // keep tex if requested
    const compileTex = join(inputDir, output);
    if (!format?.[kKeepTex]) {
      Deno.removeSync(compileTex);
    }

    // copy (or write for stdout) compiled pdf to final output location
    const compilePdf = join(inputDir, texStem + ".pdf");
    const finalOutput = options.flags?.output;
    if (finalOutput) {
      if (finalOutput === kStdOut) {
        writeFileToStdout(compilePdf);
        Deno.removeSync(compilePdf);
      } else {
        const outputPdf = expandPath(finalOutput);
        if (normalize(compilePdf) !== normalize(outputPdf)) {
          Deno.renameSync(compilePdf, outputPdf);
        }
      }
      return finalOutput;
    } else {
      return compilePdf;
    }
  };

  // tweak writer if it's pdf
  const to = format.defaults?.to === "pdf" ? "latex" : format.defaults?.to;

  // return recipe
  return {
    output,
    args,
    format: {
      ...format,
      defaults: {
        ...format.defaults,
        to,
      },
    },
    complete,
  };
}

async function runLatexmk(options: LatexmkOptions): Promise<ProcessResult> {
  // provide argument defaults
  const {
    input,
    engine: pdfEngine = { pdfEngine: "pdflatex" },
  } = options;

  // build latexmk command line
  const cmd = ["latexmk"];

  // pdf engine
  switch (pdfEngine.pdfEngine) {
    case "xelatex":
      cmd.push("-xelatex");
      break;
    case "lualatex":
      cmd.push("-lualatex");
      break;
    case "pdflatex":
      cmd.push("-pdf");
      break;
    default:
      cmd.push("-pdf");
      break;
  }

  // pdf engine opts
  const engineOpts = [
    "-halt-on-error",
    "-interaction=batchmode",
  ];
  if (pdfEngine.pdfEngineOpts) {
    engineOpts.push(...pdfEngine.pdfEngineOpts);
  }
  cmd.push(...engineOpts.map((opt) => `-latexoption=${opt}`));

  // quiet flag
  if (options.quiet) {
    cmd.push("-quiet");
  }

  // input file
  cmd.push(basename(input));

  // run
  const result = await execProcess({
    cmd,
    cwd: dirname(input),
    stdout: "piped",
  });
  if (!result.success) {
    return Promise.reject();
  }

  // cleanup if requested
  if (options.clean) {
    const cleanupResult = await execProcess({
      cmd: ["latexmk", "-c", basename(input)],
      cwd: dirname(input),
      stdout: "piped",
    });
    if (!cleanupResult.success) {
      return Promise.reject();
    }
  }

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
