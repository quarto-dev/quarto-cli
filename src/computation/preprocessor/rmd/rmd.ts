import type { ComputationPreprocessor } from "../../../api/computation.ts";
import { execProcess } from "../../../core/process.ts";

export const rmdPreprocessor: ComputationPreprocessor = {
  name: "rmd",

  canHandle: (ext: string) => {
    return [".rmd", ".rmarkdown"].includes(ext.toLowerCase());
  },

  preprocess: async (file: string, outputFile: string): Promise<void> => {
    const result = await execProcess({
      cmd: [
        "Rscript",
        "../src/computation/preprocessor/rmd/rmd.R",
        "--args",
        file,
        outputFile,
      ],
    });

    if (!result.success) {
      return Promise.reject();
    }
  },
};
