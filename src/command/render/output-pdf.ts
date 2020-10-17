import { basename, join } from "path/mod.ts";

import { Format } from "../../api/format.ts";
import { writeFileToStdout } from "../../core/console.ts";
import { dirAndStem, removeIfExists } from "../../core/path.ts";

import { kStdOut, replacePandocArg } from "./flags.ts";
import { OutputRecipe } from "./output.ts";
import { RenderOptions } from "./render.ts";
import { runTinytex } from "./tinytex.ts";

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
  const complete = async () => {
    // TODO: determine pdf-engine, pdf-engine-args, and bib engine
    const result = await runTinytex(join(inputDir, output), "", [], "");
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
    const texStem = basename(output, ".tex");
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

  // return recipe
  return {
    output,
    args,
    complete,
  };
}
