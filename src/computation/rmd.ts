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
      const result = await callR<string>(
        "spin",
        {
          input: file,
        },
        true,
      );
      return metadataFromMarkdown(result);
      // otherwise just read the metadata from the file
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
    return callR<ExecuteResult>(
      "execute",
      {
        input: file,
        format,
        output,
      },
      quiet,
    );
  },

  postProcess: (
    format: Format,
    output: string,
    preserved: { [key: string]: string },
    quiet?: boolean,
  ) => {
    if (Object.keys(preserved).length > 0) {
      return callR<string>(
        "postprocess",
        {
          format,
          output,
          preserved,
        },
        quiet,
      );
    } else {
      return Promise.resolve(output);
    }
  },
};

async function callR<T>(
  action: string,
  params: { [key: string]: unknown },
  quiet?: boolean,
): Promise<T> {
  // create a temp file for writing the results
  const resultsFile = await Deno.makeTempFile(
    { prefix: "r-results", suffix: ".json" },
  );

  const input = JSON.stringify({
    action,
    params,
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
    return resultsJson as T;
  } else {
    return Promise.reject();
  }
}
