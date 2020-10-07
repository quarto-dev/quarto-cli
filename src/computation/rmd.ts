import { execProcess } from "../core/process.ts";
import type { ComputationEngine } from "./engine.ts";
import { resourcePath } from "../core/resources.ts";
import { metadataFromFile } from "../core/metadata.ts";
import type { FormatOptions } from "../api/format.ts";
import { writeLine } from "../core/console.ts";

export const rmdEngine: ComputationEngine = {
  name: "rmd",

  canHandle: (ext: string) => {
    return [".rmd", ".rmarkdown"].includes(ext.toLowerCase());
  },

  metadata: metadataFromFile,

  process: async (
    file: string,
    format: FormatOptions,
    output: string,
  ): Promise<void> => {
    const input = JSON.stringify({
      input: file,
      format,
      output,
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

    writeLine(result.stdout!);

    if (result.success) {
      //
    } else {
      return Promise.reject();
    }
  },
};
