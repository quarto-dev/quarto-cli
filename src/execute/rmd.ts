/*
* rmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { error } from "log/mod.ts";

import { execProcess } from "../core/process.ts";
import { rBinaryPath, resourcePath } from "../core/resources.ts";
import { readYamlFromMarkdownFile } from "../core/yaml.ts";
import { partitionMarkdown } from "../core/pandoc/pandoc-partition.ts";

import { Metadata } from "../config/metadata.ts";

import {
  DependenciesOptions,
  DependenciesResult,
  ExecuteOptions,
  ExecuteResult,
  ExecutionEngine,
  kQmdExtensions,
  PostProcessOptions,
  RunOptions,
} from "./engine.ts";
import { sessionTempFile } from "../core/temp.ts";

const kRmdExtensions = [".rmd", ".rmarkdown"];

const kKnitrEngine = "knitr";

export const knitrEngine: ExecutionEngine = {
  name: kKnitrEngine,

  defaultExt: ".Rmd",

  defaultYaml: () => [],

  validExtensions: () => kRmdExtensions.concat(kQmdExtensions),

  claimsExtension: (ext: string) => {
    return kRmdExtensions.includes(ext.toLowerCase());
  },

  claimsLanguage: (language: string) => {
    return language.toLowerCase() === "r";
  },

  target: (file: string, _quiet?: boolean) => {
    return Promise.resolve({ source: file, input: file });
  },

  metadata: (file: string): Promise<Metadata> => {
    return Promise.resolve(readYamlFromMarkdownFile(file));
  },

  partitionedMarkdown: (file: string) => {
    return Promise.resolve(partitionMarkdown(Deno.readTextFileSync(file)));
  },

  execute: (options: ExecuteOptions): Promise<ExecuteResult> => {
    return callR<ExecuteResult>(
      "execute",
      options,
      options.quiet,
    );
  },

  dependencies: (options: DependenciesOptions) => {
    return callR<DependenciesResult>(
      "dependencies",
      options,
      options.quiet,
    );
  },

  postprocess: (options: PostProcessOptions) => {
    return callR<void>(
      "postprocess",
      options,
      options.quiet,
    );
  },

  canFreeze: true,

  canKeepMd: true,

  ignoreGlobs: () => {
    return ["**/renv/**", "**/packrat/**", "**/rsconnect/**"];
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
  const resultsFile = sessionTempFile(
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
        rBinaryPath("Rscript"),
        resourcePath("rmd/rmd.R"),
      ],
      stderr: quiet ? "piped" : "inherit",
    },
    input,
    "stdout>stderr",
  );

  if (result.success) {
    const results = await Deno.readTextFile(resultsFile);
    await Deno.remove(resultsFile);
    const resultsJson = JSON.parse(results);
    return resultsJson as T;
  } else {
    error(result.stderr);
    return Promise.reject();
  }
}
