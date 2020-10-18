/*
* rmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
* Unless you have received this program directly from RStudio pursuant
* to the terms of a commercial license agreement with RStudio, then
* this program is licensed to you under the terms of version 3 of the
* GNU General Public License. This program is distributed WITHOUT
* ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
* MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
* GPL (http://www.gnu.org/licenses/gpl-3.0.txt) for more details.
*
*/

import { extname } from "path/mod.ts";

import { execProcess, ProcessResult } from "../core/process.ts";
import { resourcePath } from "../core/resources.ts";

import {
  Metadata,
  metadataFromFile,
  metadataFromMarkdown,
} from "../config/metadata.ts";

import type {
  ComputationEngine,
  ExecuteOptions,
  ExecuteResult,
  LatexmkOptions,
  PostProcessOptions,
  RunOptions,
} from "./engine.ts";

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

  execute: async (options: ExecuteOptions): Promise<ExecuteResult> => {
    return callR<ExecuteResult>(
      "execute",
      options,
      options.quiet,
    );
  },

  postprocess: async (options: PostProcessOptions) => {
    return callR<void>(
      "postprocess",
      options,
      options.quiet,
    );
  },

  latexmk: (options: LatexmkOptions) => {
    return callR<void>(
      "latexmk",
      options,
    );
  },

  run: (options: RunOptions) => {
    return callR<void>(
      "run",
      options,
    );
  },
};

async function callR<T>(
  action: string,
  params: unknown,
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
