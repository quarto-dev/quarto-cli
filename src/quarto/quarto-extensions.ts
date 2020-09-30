import type { ComputationPreprocessor } from "../api/computation.ts";

import { rmdPreprocessor } from "../computation/preprocessor/rmd/rmd.ts";
import { ipynbPreprocessor } from "../computation/preprocessor/ipynb/ipynb.ts";

export function computationPreprocessorForFile(
  ext: string,
  preprocessors = computationPreprocessors(),
) {
  for (const preprocessor of preprocessors) {
    if (preprocessor.canHandle(ext)) {
      return preprocessor;
    }
  }
  return null;
}

export function computationPreprocessors(): ComputationPreprocessor[] {
  return [
    rmdPreprocessor,
    ipynbPreprocessor,
  ];
}
