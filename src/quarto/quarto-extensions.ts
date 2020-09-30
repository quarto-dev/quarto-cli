import { rmdPreprocessor } from "../computation/preprocessor/rmd/rmd.ts";
import { ipynbPreprocessor } from "../computation/preprocessor/ipynb/ipynb.ts";
import type { ComputationPreprocessor } from "../computation/preprocessor/preprocessor.ts";

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
