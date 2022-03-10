/*
* rmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { error, info, warning } from "log/mod.ts";

import * as colors from "fmt/colors.ts";

import { execProcess } from "../core/process.ts";
import { rBinaryPath, resourcePath } from "../core/resources.ts";
import { readYamlFromMarkdown } from "../core/yaml.ts";
import { partitionMarkdown } from "../core/pandoc/pandoc-partition.ts";

import { kCodeLink } from "../config/constants.ts";

import {
  knitrCapabilities,
  knitrCapabilitiesMessage,
  knitrInstallationMessage,
  rInstallationMessage,
} from "../core/knitr.ts";
import {
  DependenciesOptions,
  DependenciesResult,
  ExecuteOptions,
  ExecuteResult,
  ExecutionEngine,
  ExecutionTarget,
  kKnitrEngine,
  PostProcessOptions,
  RunOptions,
} from "./types.ts";
import { postProcessRestorePreservedHtml } from "./engine-shared.ts";

const kRmdExtensions = [".rmd", ".rmarkdown"];

export const knitrEngine: ExecutionEngine = {
  name: kKnitrEngine,

  defaultExt: ".qmd",

  defaultYaml: () => [],

  defaultContent: () => [
    "```{r}",
    "1 + 1",
    "```",
  ],

  validExtensions: () => kRmdExtensions.concat(kRmdExtensions),

  claimsExtension: (ext: string) => {
    return kRmdExtensions.includes(ext.toLowerCase());
  },

  claimsLanguage: (language: string) => {
    return language.toLowerCase() === "r";
  },

  target: (file: string, _quiet?: boolean) => {
    const markdown = Deno.readTextFileSync(file);
    const target: ExecutionTarget = {
      source: file,
      input: file,
      markdown,
      metadata: readYamlFromMarkdown(markdown),
      refreshTarget(newMarkdown: string): Promise<ExecutionTarget> {
        if (newMarkdown === this.markdown) {
          return Promise.resolve(this);
        }
        const newTarget: ExecutionTarget = { ...this };
        newTarget.markdown = newMarkdown;
        newTarget.metadata = readYamlFromMarkdown(markdown);
        return Promise.resolve(newTarget);
      },
    };
    return Promise.resolve(target);
  },

  partitionedMarkdown: (file: string) => {
    return Promise.resolve(partitionMarkdown(Deno.readTextFileSync(file)));
  },

  execute: (options: ExecuteOptions): Promise<ExecuteResult> => {
    return callR<ExecuteResult>(
      "execute",
      { ...options, target: undefined, input: options.target.input },
      options.tempDir,
      options.quiet,
    );
  },

  dependencies: (options: DependenciesOptions) => {
    return callR<DependenciesResult>(
      "dependencies",
      { ...options, target: undefined, input: options.target.input },
      options.tempDir,
      options.quiet,
    );
  },

  postprocess: async (options: PostProcessOptions) => {
    // handle preserved html in js-land
    postProcessRestorePreservedHtml(options);

    // see if we can code link
    if (options.format.render?.[kCodeLink]) {
      await callR<void>(
        "postprocess",
        {
          ...options,
          target: undefined,
          preserve: undefined,
          input: options.target.input,
        },
        options.tempDir,
        options.quiet,
        false,
      ).then(() => {
        return Promise.resolve();
      }, () => {
        warning(
          `Unable to perform code-link (code-link requires R and the downlit package)`,
        );
        return Promise.resolve();
      });
    }
  },

  canFreeze: true,
  generatesFigures: true,

  ignoreDirs: () => {
    return ["renv", "packrat", "rsconnect"];
  },

  run: (options: RunOptions) => {
    return callR<void>(
      "run",
      options,
      options.tempDir,
    );
  },
};

async function callR<T>(
  action: string,
  params: unknown,
  tempDir: string,
  quiet?: boolean,
  reportError = true,
): Promise<T> {
  // create a temp file for writing the results
  const resultsFile = Deno.makeTempFileSync(
    { dir: tempDir, prefix: "r-results", suffix: ".json" },
  );

  const input = JSON.stringify({
    action,
    params,
    results: resultsFile,
  });

  try {
    const result = await execProcess(
      {
        cmd: [
          await rBinaryPath("Rscript"),
          resourcePath("rmd/rmd.R"),
        ],
        stderr: quiet ? "piped" : "inherit",
      },
      input,
      "stdout>stderr",
      colors.red,
    );

    if (result.success) {
      const results = await Deno.readTextFile(resultsFile);
      await Deno.remove(resultsFile);
      const resultsJson = JSON.parse(results);
      return resultsJson as T;
    } else {
      // quiet means don't print in normal cases, but
      // we still need to report errors
      if (quiet) {
        error(result.stderr || "");
      }
      if (reportError) {
        await printCallRDiagnostics();
      }
      return Promise.reject();
    }
  } catch (e) {
    if (reportError) {
      if (e?.message) {
        info("");
        error(e.message);
      }
      await printCallRDiagnostics();
    }
    return Promise.reject();
  }
}

async function printCallRDiagnostics() {
  const caps = await knitrCapabilities();
  if (caps && !caps.rmarkdown) {
    info("");
    info("R installation:");
    info(knitrCapabilitiesMessage(caps, "  "));
    info("");
    info(knitrInstallationMessage());
    info("");
  } else if (!caps) {
    info("");
    info(rInstallationMessage());
    info("");
  }
}
