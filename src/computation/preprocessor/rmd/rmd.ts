import type { Metadata } from "../../../core/metadata.ts";
import { execProcess } from "../../../core/process.ts";
import type { ComputationPreprocessor } from "../preprocessor.ts";
import { resourcePath } from "../../../core/resources.ts";
import { metadataFromFile } from "../../../core/metadata.ts";
import type { Format } from "../../../api/format.ts";

export const rmdPreprocessor: ComputationPreprocessor = {
  name: "rmd",

  canHandle: (ext: string) => {
    return [".rmd", ".rmarkdown"].includes(ext.toLowerCase());
  },

  metadata: metadataFromFile,

  preprocess: async (
    file: string,
    format: Format,
    outputFile: string,
  ): Promise<void> => {
    const input = JSON.stringify({
      input: file,
      format,
      output: outputFile,
    });

    const result = await execProcess(
      {
        cmd: [
          "Rscript",
          resourcePath("rmd.R"),
        ],
      },
      input,
    );

    if (!result.success) {
      return Promise.reject();
    }
  },
};
