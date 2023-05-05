/*
* output-typst.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { dirname, join, normalize, relative } from "path/mod.ts";
import { ensureDirSync } from "fs/mod.ts";

import { kKeepTyp, kOutputExt, kOutputFile } from "../../config/constants.ts";
import { Format } from "../../config/types.ts";
import { writeFileToStdout } from "../../core/console.ts";
import { dirAndStem, expandPath } from "../../core/path.ts";
import { kStdOut, replacePandocOutputArg } from "./flags.ts";
import { OutputRecipe, RenderOptions } from "./types.ts";
import { normalizeOutputPath } from "./output.ts";
import {
  typstCompile,
  validateRequiredTypstVersion,
} from "../../core/typst.ts";

export function useTypstPdfOutputRecipe(
  format: Format,
) {
  return format.pandoc.to === "typst" &&
    format.render[kOutputExt] === "pdf";
}

export function typstPdfOutputRecipe(
  input: string,
  finalOutput: string,
  options: RenderOptions,
  format: Format,
): OutputRecipe {
  // cacluate output and args for pandoc (this is an intermediate file
  // which we will then compile to a pdf and rename to .typ)
  const [inputDir, inputStem] = dirAndStem(input);
  const output = inputStem + ".typ";
  let args = options.pandocArgs || [];
  const pandoc = { ...format.pandoc };
  if (options.flags?.output) {
    args = replacePandocOutputArg(args, output);
  } else {
    pandoc[kOutputFile] = output;
  }

  // when pandoc is done, we need to run the pdf generator and then copy the
  // ouptut to the user's requested destination
  const complete = async () => {
    // input file is pandoc's output
    const input = join(inputDir, output);

    // run typst
    await validateRequiredTypstVersion();
    const pdfOutput = join(inputDir, inputStem + ".pdf");
    const result = await typstCompile(input, pdfOutput, options.flags?.quiet);
    if (!result.success) {
      throw new Error();
    }

    // keep typ if requested
    if (!format.render[kKeepTyp]) {
      Deno.removeSync(input);
    }

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

      // final output needs to either absolute or input dir relative
      // (however it may be working dir relative when it is passed in)
      return normalizeOutputPath(input, finalOutput);
    } else {
      return normalizeOutputPath(input, pdfOutput);
    }
  };

  const pdfOutput = finalOutput
    ? finalOutput === kStdOut
      ? undefined
      : normalizeOutputPath(input, finalOutput)
    : normalizeOutputPath(input, join(inputDir, inputStem + ".pdf"));

  // return recipe
  return {
    output,
    keepYaml: false,
    args,
    format: { ...format, pandoc },
    complete,
    finalOutput: pdfOutput ? relative(inputDir, pdfOutput) : undefined,
  };
}
