import { basename, join } from "path/mod.ts";

import { dirAndStem, removeIfExists } from "../../core/path.ts";
import { execProcess, ProcessResult } from "../../core/process.ts";
import { pdfOutputRecipe } from "./output.ts";
import { PdfEngine } from "./pandoc.ts";

export interface TinytexOptions {
  input: string;
  output?: string; // default: input.pdf
  pdfEngine?: PdfEngine; // default: pdflatex
  emulation?: boolean; // default: true
  install?: boolean; // default: emulation
  minTimes?: number; // default: 1
  maxTimes?: number; // default: 10
  clean?: boolean; // default: true
}

export async function runTinytex(
  options: TinytexOptions,
): Promise<ProcessResult> {
  // provide argument defaults
  const {
    input,
    pdfEngine = { pdfEngine: "pdflatex" },
    emulation = true,
    install = emulation,
    minTimes = 1,
    maxTimes = 10,
    clean = true,
  } = options;

  // provide output if needed
  const [inputDir, inputStem] = dirAndStem(input);
  const output = options.output ? options.output : join(inputStem + ".pdf");

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
