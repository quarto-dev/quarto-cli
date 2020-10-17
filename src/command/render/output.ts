/*
* output.ts
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

import { basename, isAbsolute, join, relative } from "path/mod.ts";

import { Format, FormatPandoc } from "../../api/format.ts";
import { writeFileToStdout } from "../../core/console.ts";
import { dirAndStem, removeIfExists } from "../../core/path.ts";

import { kStdOut, replacePandocArg } from "./flags.ts";
import { pandocMetadata, PandocOptions, pdfEngine } from "./pandoc.ts";
import { RenderOptions } from "./render.ts";
import { runTinytex } from "./tinytex.ts";

// render command lines imply the --output argument for pandoc and the final
// output file to create for the user, but we need a 'recipe' to go from
// this spec to what we should actually pass on the command line. considerations
// include providing the default extension, dealing with output to stdout,
// and rendering pdfs (which require an additional step after pandoc)

export interface OutputRecipe {
  // --output file that pandoc will produce
  output: string;
  // transformed pandoc args reflecting 'output'
  args: string[];
  // modifications to pandoc format spec
  pandoc: FormatPandoc;
  // callback for completing the output recipe (e.g. might run pdflatex, etc.).
  // can optionally return an alternate output path. passed the actual
  // options used to run pandoc (for deducing e.g. pdf engine options)
  complete: (options: PandocOptions) => Promise<string | undefined>;
}

export function outputRecipe(
  options: RenderOptions,
  format: Format,
): OutputRecipe {
  // alias & provide defaults for some variables
  const writer = format.pandoc?.writer;
  const ext = format.output?.ext || "html";

  // pdfs have their own special set of rules
  if (isPdfOutput(writer, ext)) {
    return pdfOutputRecipe(options, format);
  } else {
    // default recipe spec based on user input
    const recipe = {
      output: options.flags?.output!,
      args: options.pandocArgs || [],
      pandoc: {},
      complete: async (): Promise<string | undefined> => {
        return;
      },
    };

    // compute dir and stem
    const [inputDir, inputStem] = dirAndStem(options.input);

    if (!recipe.output) {
      // no output on the command line: derive an output path from the extension
      recipe.output = join(inputStem + "." + ext);
      recipe.args.unshift("--output", recipe.output);
    } else if (recipe.output === kStdOut) {
      // output to stdout: direct pandoc to write to a temp file then we'll
      // forward to stdout (necessary b/c a postprocesor may need to act on
      // the output before its complete)
      recipe.output = Deno.makeTempFileSync({ suffix: "." + ext });
      recipe.complete = async () => {
        writeFileToStdout(recipe.output);
        Deno.removeSync(recipe.output);
        return undefined;
      };
    } else if (!isAbsolute(recipe.output)) {
      // relatve output file on the command line: make it relative to the input dir
      // for pandoc (which will run in the input dir)
      recipe.output = relative(inputDir, recipe.output);
      recipe.args = replacePandocArg(recipe.args, "--output", recipe.output);
    }

    // return
    return recipe;
  }
}

export function isPdfOutput(writer?: string, ext?: string) {
  return ["latex", "beamer", "pdf"].includes(writer || "") && ext === "pdf";
}

export function pdfOutputRecipe(
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

  // when pandoc is done, we need to run pdf latex and then copy the
  // ouptut to the user's requested destination
  const complete = async (pandocOptions: PandocOptions) => {
    // compute texStem
    const texStem = basename(output, ".tex");

    // determine tinytex options
    const metadata = pandocMetadata(pandocOptions);
    const ttOptions = {
      input: join(inputDir, output),
      output: texStem + ".pdf",
      pdfEngine: pdfEngine(metadata, pandocOptions.flags),
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
