import type { Metadata } from "../../../core/metadata.ts";
import { execProcess } from "../../../core/process.ts";
import type { ComputationPreprocessor } from "../preprocessor.ts";
import { resourcePath } from "../../../core/resources.ts";
import { readMetadata } from "../../../core/pandoc.ts";

export const rmdPreprocessor: ComputationPreprocessor = {
  name: "rmd",

  canHandle: (ext: string) => {
    return [".rmd", ".rmarkdown"].includes(ext.toLowerCase());
  },

  metadata: readMetadata,

  preprocess: async (file: string, outputFile: string): Promise<void> => {
    const result = await execProcess({
      cmd: [
        "Rscript",
        resourcePath("rmd.R"),
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
