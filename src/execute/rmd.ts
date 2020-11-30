/*
* rmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { extname, join } from "path/mod.ts";

import { dirAndStem } from "../core/path.ts";
import { execProcess } from "../core/process.ts";
import { resourcePath, rPath } from "../core/resources.ts";
import {
  readYamlFromMarkdown,
  readYamlFromMarkdownFile,
} from "../core/yaml.ts";

import { Metadata } from "../config/metadata.ts";

import type {
  ExecuteOptions,
  ExecuteResult,
  ExecutionEngine,
  ExecutionTarget,
  LatexmkOptions,
  PostProcessOptions,
  RunOptions,
} from "./engine.ts";

const kRmdExtensions = [".rmd", ".rmarkdown"];
const kRScriptExtensions = [".r", ".s", ".q"];
const kEngineExtensions = [...kRmdExtensions, ...kRScriptExtensions];

export const rmdEngine: ExecutionEngine = {
  name: "rmarkdown",

  handle: async (file: string, _quiet: boolean) => {
    if (kEngineExtensions.includes(extname(file).toLowerCase())) {
      return { input: file };
    }
  },

  metadata: async (target: ExecutionTarget): Promise<Metadata> => {
    if (kRScriptExtensions.includes(extname(target.input.toLowerCase()))) {
      // if it's an R script, spin it into markdown
      const result = await callR<string>(
        "spin",
        {
          input: target.input,
        },
        true,
      );
      return readYamlFromMarkdown(result);
    } else {
      // otherwise just read the metadata from the file
      return readYamlFromMarkdownFile(target.input);
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

  keepMd: (input: string) => {
    const [inputDir, inputStem] = dirAndStem(input);
    return join(inputDir, inputStem + ".md");
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
        rPath("Rscript"),
        resourcePath("rmd/rmd.R"),
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
