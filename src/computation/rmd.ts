import type { Format } from "../api/format.ts";

import {
  Metadata,
  metadataFromFile,
  metadataFromMarkdown,
} from "../config/metadata.ts";

import { execProcess } from "../core/process.ts";
import { resourcePath } from "../core/resources.ts";

import type { ComputationEngine, ExecuteResult } from "./engine.ts";

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
        return metadataFromMarkdown(result.stdout || "");
      } else {
        return Promise.reject(new Error(result.stderr || "Unknown error"));
      }
    } else {
      return metadataFromFile(file);
    }
  },

  execute: async (
    file: string,
    format: Format,
    output: string,
    quiet?: boolean,
  ): Promise<ExecuteResult> => {
    // create a temp file for writing the results
    const resultsFile = await Deno.makeTempFile(
      { prefix: "rmd-render-results", suffix: ".json" },
    );

    const input = JSON.stringify({
      action: "execute",
      params: {
        input: file,
        format,
        output,
      },
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
      await Deno.remove(resultsFile);
      const resultsJson = JSON.parse(results);
      return {
        supporting: resultsJson.supporting || [],
        includes: resultsJson.includes || {},
      };
    } else {
      return Promise.reject();
    }
  },

  postProcess: (
    format: Format,
    output: string,
    quiet?: boolean,
  ) => {
    return Promise.resolve(output);
  },
};
