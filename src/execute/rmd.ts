/*
* rmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { extname, join } from "path/mod.ts";
import { error } from "log/mod.ts";

import { dirAndStem } from "../core/path.ts";
import { execProcess } from "../core/process.ts";
import { rBinaryPath, resourcePath } from "../core/resources.ts";
import {
  readYamlFromMarkdown,
  readYamlFromMarkdownFile,
} from "../core/yaml.ts";

import { Metadata } from "../config/metadata.ts";

import type {
  DependenciesOptions,
  DependenciesResult,
  ExecuteOptions,
  ExecuteResult,
  ExecutionEngine,
  PostProcessOptions,
  RunOptions,
} from "./engine.ts";
import { sessionTempFile } from "../core/temp.ts";

const kRmdExtensions = [".rmd", ".rmarkdown"];
const kRScriptExtensions = [".r", ".s", ".q"];
const kEngineExtensions = [...kRmdExtensions, ...kRScriptExtensions];

export const knitrEngine: ExecutionEngine = {
  name: "knitr",

  defaultExt: ".Rmd",

  defaultYaml: () => [],

  canHandle: (file: string, contentOnly: boolean) => {
    const extensions = contentOnly ? kRmdExtensions : kEngineExtensions;
    return extensions.includes(extname(file).toLowerCase());
  },

  target: (file: string, quiet?: boolean) => {
    return Promise.resolve({ source: file, input: file });
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
      return readYamlFromMarkdown(result);
    } else {
      // otherwise just read the metadata from the file
      return readYamlFromMarkdownFile(file);
    }
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

  keepMd,

  keepFiles: (input: string) => [keepMd(input)],

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

function keepMd(input: string) {
  const [inputDir, inputStem] = dirAndStem(input);
  return join(inputDir, inputStem + ".md");
}

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
