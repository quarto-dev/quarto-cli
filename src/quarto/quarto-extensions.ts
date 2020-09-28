import type { ComputationPreprocessor } from "../api/computation.ts";

import { knitrPreprocessor } from "../computation/preprocessor/knitr/knitr.ts";
import { nbconvertPreprocessor } from "../computation/preprocessor/nbconvert/nbconv.ts";

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
    knitrPreprocessor,
    nbconvertPreprocessor,
  ];
}
