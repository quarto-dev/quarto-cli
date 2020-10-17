import { basename, join } from "path/mod.ts";

import { Format } from "../../api/format.ts";
import { writeFileToStdout } from "../../core/console.ts";
import { removeIfExists } from "../../core/path.ts";

import { execProcess } from "../../core/process.ts";

import { kStdOut, replacePandocArg } from "./flags.ts";
import { RenderOptions } from "./render.ts";

// TOOD: some constants for file extensions

// TODO: we seem to leave the text file laying around

export function isPdfOutput(writer?: string, ext?: string) {
  return ["latex", "beamer"].includes(writer || "") && ext === "pdf";
}

export function pdfOutputRecipe(
  options: RenderOptions,
  inputDir: string,
  inputStem: string,
  format: Format,
) {
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
    // run pdflatex (wihin the inputDir so we are not exposed to any parent path issues)
    const texFile = output;
    const texStem = basename(texFile, ".tex");
    const result = await execProcess({
      cmd: ["pdflatex", texFile],
      cwd: inputDir,
    });
    if (!result.success) {
      return Promise.reject();
    }

    // cleanup intermediates
    ["toc", "out", "aux", "log"].forEach((ext) => {
      removeIfExists(join(inputDir, texStem + "." + ext));
    });

    // keep tex if requested
    const compileTex = join(inputDir, texFile);
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
      Deno.renameSync(compilePdf, output);
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
