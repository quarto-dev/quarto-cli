import { basename, dirname, extname, join } from "path/mod.ts";

import { execProcess, ProcessResult } from "../core/process.ts";

const kMarkdownExt = ".md";
const kKnitrExt = ".Rmd";
const kNbconvertExt = ".ipynb";

export async function render(input: string): Promise<ProcessResult> {
  // calculate output markdown for input
  const mdOutput = (ext: string) => {
    const input_dir = dirname(input);
    const input_base = basename(input, ext);
    return join(input_dir, input_base + kMarkdownExt);
  };

  // determine output file and preprocessor
  let output: string;
  let preprocess: Promise<ProcessResult> | null = null;

  // knitr for .Rmd
  const ext = extname(input);
  if (ext.endsWith(kKnitrExt)) {
    output = mdOutput(kKnitrExt);
    preprocess = execProcess({
      cmd: [
        "Rscript",
        "../src/computation/preprocessor/knitr.R",
        "--args",
        input,
        output,
      ],
    });

    // nbconvert for .ipynb
  } else if (ext.endsWith(kNbconvertExt)) {
    output = mdOutput(kNbconvertExt);
    preprocess = execProcess({
      cmd: [
        Deno.env.get("CONDA_PREFIX")! + "/bin/python",
        "../src/computation/preprocessor/nbconv.py",
        input,
        output,
      ],
    });

    // no preprocessing for .md
  } else if (ext.endsWith(kMarkdownExt)) {
    output = mdOutput(kMarkdownExt);

    // not supported
  } else {
    return Promise.reject(new Error("Unsupported input file: " + input));
  }

  // preprocess if necessary
  if (preprocess) {
    const result = await preprocess;
    if (!result.success) {
      return result;
    }
  }

  // run pandoc
  return execProcess({
    cmd: ["pandoc", output],
  });
}
