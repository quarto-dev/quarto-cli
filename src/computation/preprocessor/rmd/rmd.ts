import { execProcess } from "../../../core/process.ts";
import type { ComputationPreprocessor } from "../preprocessor.ts";
import { resourcePath } from "../../../core/resources.ts";
import { metadataFromFile } from "../../../core/metadata.ts";
import type { FormatOptions } from "../../../api/format.ts";
import { writeLine } from "../../../core/console.ts";

export const rmdPreprocessor: ComputationPreprocessor = {
  name: "rmd",

  canHandle: (ext: string) => {
    return [".rmd", ".rmarkdown"].includes(ext.toLowerCase());
  },

  metadata: metadataFromFile,

  preprocess: async (
    file: string,
    format: FormatOptions,
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
        stdout: "piped",
      },
      input,
      // stream stdout to stderr
      (data: Uint8Array) => {
        Deno.stderr.writeSync(data);
      },
    );

    writeLine(Deno.stderr, result.stdout!);

    if (result.success) {
      //
    } else {
      return Promise.reject();
    }
  },
};
