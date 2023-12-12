/*
 * output-typst.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { dirname, join, normalize, relative } from "path/mod.ts";
import { ensureDirSync } from "fs/mod.ts";

import {
  kFontPaths,
  kKeepTyp,
  kOutputExt,
  kOutputFile,
  kVariant,
} from "../../config/constants.ts";
import { Format } from "../../config/types.ts";
import { writeFileToStdout } from "../../core/console.ts";
import { dirAndStem, expandPath } from "../../core/path.ts";
import { kStdOut, replacePandocOutputArg } from "./flags.ts";
import { OutputRecipe, RenderOptions } from "./types.ts";
import { normalizeOutputPath } from "./output-shared.ts";
import {
  typstCompile,
  TypstCompileOptions,
  validateRequiredTypstVersion,
} from "../../core/typst.ts";
import { asArray } from "../../core/array.ts";
import { ProjectContext } from "../../project/types.ts";

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
  project?: ProjectContext,
): OutputRecipe {
  // calculate output and args for pandoc (this is an intermediate file
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
  // output to the user's requested destination
  const complete = async () => {
    // input file is pandoc's output
    const input = join(inputDir, output);

    // run typst
    await validateRequiredTypstVersion();
    const pdfOutput = join(inputDir, inputStem + ".pdf");
    const typstOptions: TypstCompileOptions = {
      quiet: options.flags?.quiet,
      fontPaths: asArray(format.metadata?.[kFontPaths]) as string[],
    };
    if (project?.dir) {
      typstOptions.rootDir = project.dir;
    }
    const result = await typstCompile(
      input,
      pdfOutput,
      typstOptions,
    );
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
  const recipe: OutputRecipe = {
    output,
    keepYaml: false,
    args,
    format: { ...format, pandoc },
    complete,
    finalOutput: pdfOutput ? relative(inputDir, pdfOutput) : undefined,
  };

  // if we have some variant declared, resolve it
  // (use for opt-out citations extension)
  if (format.render?.[kVariant]) {
    const to = format.pandoc.to;
    const variant = format.render[kVariant];

    recipe.format = {
      ...recipe.format,
      pandoc: {
        ...recipe.format.pandoc,
        to: `${to}${variant}`,
      },
    };
  }

  return recipe;
}
