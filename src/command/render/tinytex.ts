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

import { dirAndStem, removeIfExists } from "../../core/path.ts";
import { execProcess, ProcessResult } from "../../core/process.ts";
import { PdfEngine } from "./pandoc.ts";

// ported from tinytex package:
// https://github.com/yihui/tinytex/blob/5199a89d0d7c01b166eb7dced1b117c67b569774/R/latex.R

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

function cleanup(input: string) {
  const [inputDir, inputStem] = dirAndStem(input);
  const aux = [
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
  ];
}
