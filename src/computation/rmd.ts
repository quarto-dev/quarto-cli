import { extname } from "path/mod.ts";

import type { Format } from "../api/format.ts";

import {
  Metadata,
  metadataFromFile,
  metadataFromMarkdown,
} from "../config/metadata.ts";

import { execProcess } from "../core/process.ts";
import { resourcePath } from "../core/resources.ts";

import type { ComputationEngine, ExecuteResult } from "./engine.ts";

const kRmdExtensions = [".rmd", ".rmarkdown"];
const kRScriptExtensions = [".r", ".s", ".q"];
const kEngineExtensions = [...kRmdExtensions, ...kRScriptExtensions];

export const rmdEngine: ComputationEngine = {
  name: "rmd",

  canHandle: (ext: string) => {
    return kEngineExtensions.includes(ext.toLowerCase());
  },

  metadata: async (file: string): Promise<Metadata> => {
    if (kRScriptExtensions.includes(extname(file.toLowerCase()))) {
      // if it's an R script, spin it into markdown
      const result = await callR<string>(
        "spin",
        {
          input: file,
        },
        true,
      );
      return metadataFromMarkdown(result);
    } else {
      // otherwise just read the metadata from the file
      return metadataFromFile(file);
    }
  },

  execute: async (
    input: string,
    format: Format,
    output: string,
    quiet?: boolean,
  ): Promise<ExecuteResult> => {
    return callR<ExecuteResult>(
      "execute",
      {
        input,
        format,
        output,
      },
      quiet,
    );
  },

  postprocess: async (
    format: Format,
    output: string,
    data: unknown,
    quiet?: boolean,
  ) => {
    return callR<string>(
      "postprocess",
      {
        format,
        output,
        data,
      },
      quiet,
    );
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
    const results = await Deno.readTextFile(resultsFile);
    await Deno.remove(resultsFile);
    const resultsJson = JSON.parse(results);
    return resultsJson as T;
  } else {
    return Promise.reject();
  }
}
