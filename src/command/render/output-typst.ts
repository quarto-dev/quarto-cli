/*
 * output-typst.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { dirname, join, normalize, relative } from "../../deno_ral/path.ts";
import { ensureDirSync, safeRemoveSync } from "../../deno_ral/fs.ts";

import {
  kFontPaths,
  kKeepTyp,
  kOutputExt,
  kOutputFile,
  kPdfStandard,
  kVariant,
} from "../../config/constants.ts";
import { error, warning } from "../../deno_ral/log.ts";
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
import { validatePdfStandards } from "../../core/verapdf.ts";

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
      pdfStandard: normalizePdfStandardForTypst(
        asArray(
          format.render?.[kPdfStandard] ?? format.metadata?.[kPdfStandard],
        ),
      ),
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
      // Log the error so test framework can detect it via shouldError
      if (result.stderr) {
        error(result.stderr);
      }
      throw new Error("Typst compilation failed");
    }

    // Validate PDF against specified standards using verapdf (if available)
    const pdfStandards = asArray(
      format.render?.[kPdfStandard] ?? format.metadata?.[kPdfStandard],
    ) as string[];
    if (pdfStandards.length > 0) {
      await validatePdfStandards(pdfOutput, pdfStandards, {
        quiet: options.flags?.quiet,
      });
    }

    // keep typ if requested
    if (!format.render[kKeepTyp]) {
      safeRemoveSync(input);
    }

    // copy (or write for stdout) compiled pdf to final output location
    if (finalOutput) {
      if (finalOutput === kStdOut) {
        writeFileToStdout(pdfOutput);
        safeRemoveSync(pdfOutput);
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

// Typst-supported PDF standards
const kTypstSupportedStandards = new Set([
  "1.4",
  "1.5",
  "1.6",
  "1.7",
  "2.0",
  "a-1b",
  "a-1a",
  "a-2b",
  "a-2u",
  "a-2a",
  "a-3b",
  "a-3u",
  "a-3a",
  "a-4",
  "a-4f",
  "a-4e",
  "ua-1",
]);

function normalizePdfStandardForTypst(standards: unknown[]): string[] {
  const result: string[] = [];
  for (const s of standards) {
    // Convert to string - YAML may parse versions like 2.0 as integer 2
    let str: string;
    if (typeof s === "number") {
      // Handle YAML numeric parsing: integer 2 -> "2.0", float 1.4 -> "1.4"
      str = Number.isInteger(s) ? `${s}.0` : String(s);
    } else if (typeof s === "string") {
      str = s;
    } else {
      continue;
    }
    // Normalize: lowercase, remove any "pdf" prefix
    const normalized = str.toLowerCase().replace(/^pdf[/-]?/, "");
    if (kTypstSupportedStandards.has(normalized)) {
      result.push(normalized);
    } else {
      warning(
        `PDF standard '${s}' is not supported by Typst and will be ignored`,
      );
    }
  }
  return result;
}
