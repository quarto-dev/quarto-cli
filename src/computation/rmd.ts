import type { FormatOptions } from "../api/format.ts";

import { execProcess } from "../core/process.ts";
import { resourcePath } from "../core/resources.ts";
import {
  Metadata,
  metadataFromFile,
  metadataFromMarkdown,
} from "../core/metadata.ts";

import type { ComputationEngine, ComputationEngineResult } from "./engine.ts";

export const rmdEngine: ComputationEngine = {
  name: "rmd",

  canHandle: (ext: string) => {
    return [".rmd", ".rmarkdown", ".r"].includes(ext.toLowerCase());
  },

  metadata: async (file: string): Promise<Metadata> => {
    // if it's an R script, spin it into markdown
    if (file.toLowerCase().endsWith(".r")) {
      const result = await execProcess({
        cmd: [
          "Rscript",
          resourcePath("rmd-spin.R"),
          "--args",
          file,
        ],
        stdout: "piped",
        stderr: "piped",
      });
      if (result.success) {
        return metadataFromMarkdown(result.stdout!);
      } else {
        return Promise.reject(new Error(result.stderr!));
      }
    } else {
      return metadataFromFile(file);
    }
  },

  process: async (
    file: string,
    format: FormatOptions,
    output: string,
    quiet?: boolean,
  ): Promise<ComputationEngineResult> => {
    // create a temp file for writing the results
    const resultsFile = await Deno.makeTempFile(
      { prefix: "rmd-render-results", suffix: ".json" },
    );

    const input = JSON.stringify({
      input: file,
      format,
      output,
      results: resultsFile,
    });

    const result = await execProcess(
      {
        cmd: [
          "Rscript",
          resourcePath("rmd.R"),
        ],
        stdout: "piped",
        stderr: quiet ? "piped" : undefined,
      },
      input,
      // stream stdout to stderr
      (data: Uint8Array) => {
        if (!quiet) {
          Deno.stderr.writeSync(data);
        }
      },
    );

    if (result.success) {
      // read the results
      const results = await Deno.readTextFile(resultsFile);
      const resultsJson = JSON.parse(results);
      let supporting: string[] = [];
      if (resultsJson.files_dir) {
        supporting = supporting.concat(resultsJson["files_dir"]);
      }
      await Deno.remove(resultsFile);
      return {
        supporting,
      };
    } else {
      return Promise.reject();
    }
  },
};
