/*
 * rmd.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { error, info, warning } from "log/mod.ts";
import { existsSync } from "fs/exists.ts";
import { basename, extname } from "path/mod.ts";

import * as colors from "fmt/colors.ts";

import { execProcess } from "../core/process.ts";
import { rBinaryPath, resourcePath } from "../core/resources.ts";
import { readYamlFromMarkdown } from "../core/yaml.ts";
import { partitionMarkdown } from "../core/pandoc/pandoc-partition.ts";

import { kCodeLink } from "../config/constants.ts";

import {
  checkRBinary,
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
import { mappedStringFromFile } from "../core/mapped-text.ts";
import {
  asMappedString,
  mappedIndexToLineCol,
  MappedString,
} from "../core/lib/mapped-text.ts";
import { lineColToIndex } from "../core/lib/text.ts";
import { executeInlineCodeHandler } from "../core/execute-inline.ts";
import { globalTempContext } from "../core/temp.ts";
import { ProjectContext } from "../project/types.ts";

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

  claimsFile: (file: string, ext: string) => {
    return kRmdExtensions.includes(ext.toLowerCase()) ||
      isKnitrSpinScript(file);
  },

  claimsLanguage: (language: string) => {
    return language.toLowerCase() === "r";
  },

  target: async (
    file: string,
    _quiet: boolean | undefined,
    markdown: MappedString | undefined,
    project: ProjectContext,
  ): Promise<ExecutionTarget | undefined> => {
    const isSpin = isKnitrSpinScript(file);
    if (isSpin) {
      markdown = asMappedString(await markdownFromKnitrSpinScript(file));
    }
    let metadata;
    markdown = await project.resolveFullMarkdownForFile(file, markdown, isSpin);
    try {
      metadata = readYamlFromMarkdown(markdown.value);
    } catch (e) {
      error(`Error reading metadata from ${file}.\n${e.message}`);
      throw e;
    }
    const target: ExecutionTarget = {
      source: file,
      input: file,
      markdown,
      metadata,
    };
    return Promise.resolve(target);
  },

  partitionedMarkdown: async (file: string) => {
    if (isKnitrSpinScript(file)) {
      return partitionMarkdown(await markdownFromKnitrSpinScript(file));
    } else {
      return partitionMarkdown(Deno.readTextFileSync(file));
    }
  },

  execute: async (options: ExecuteOptions): Promise<ExecuteResult> => {
    const inputBasename = basename(options.target.input);
    const inputStem = basename(inputBasename, extname(inputBasename));

    const result = await callR<ExecuteResult>(
      "execute",
      {
        ...options,
        target: undefined,
        input: options.target.input,
        markdown: resolveInlineExecute(options.target.markdown.value),
      },
      options.tempDir,
      options.projectDir,
      options.quiet,
      // fixup .rmarkdown file references
      (output) => {
        output = output.replaceAll(`${inputStem}.rmarkdown`, inputBasename);

        const m = output.match(/^Quitting from lines (\d+)-(\d+)/m);
        if (m) {
          const f1 = lineColToIndex(options.target.markdown.value);
          const f2 = mappedIndexToLineCol(options.target.markdown);

          const newLine1 = f2(f1({ line: Number(m[1]) - 1, column: 0 })).line +
            1;
          const newLine2 = f2(f1({ line: Number(m[2]) - 1, column: 0 })).line +
            1;
          output = output.replace(
            /^Quitting from lines (\d+)-(\d+)/m,
            `\n\nQuitting from lines ${newLine1}-${newLine2}`,
          );
        }

        output = filterAlwaysAllowHtml(output);

        return output;
      },
    );
    const includes = result.includes as unknown;
    // knitr appears to return [] instead of {} as the value for includes.
    if (Array.isArray(includes) && includes.length === 0) {
      result.includes = {};
    }
    return result;
  },

  dependencies: (options: DependenciesOptions) => {
    return callR<DependenciesResult>(
      "dependencies",
      { ...options, target: undefined, input: options.target.input },
      options.tempDir,
      options.projectDir,
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
        options.projectDir,
        options.quiet,
        undefined,
        false,
      ).then(() => {
        return Promise.resolve();
      }, () => {
        warning(
          `Unable to perform code-link (code-link requires R packages rmarkdown, downlit, and xml2)`,
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
    let running = false;
    return callR<void>(
      "run",
      options,
      options.tempDir,
      options.projectDir,
      undefined,
      // wait for 'listening' to call onReady
      (output) => {
        const kListeningPattern = /(Listening on) (https?:\/\/[^\n]*)/;
        if (!running) {
          const listeningMatch = output.match(kListeningPattern);
          if (listeningMatch) {
            running = true;
            output = output.replace(kListeningPattern, "");
            if (options.onReady) {
              options.onReady();
            }
          }
        }
        return output;
      },
    );
  },
};

async function callR<T>(
  action: string,
  params: unknown,
  tempDir: string,
  projectDir?: string,
  quiet?: boolean,
  outputFilter?: (output: string) => string,
  reportError = true,
): Promise<T> {
  // establish cwd for our R scripts (the current dir if there is an renv
  // otherwise the project dir if specified)
  const cwd = withinActiveRenv() ? Deno.cwd() : projectDir ?? Deno.cwd();

  // create a temp file for writing the results
  const resultsFile = Deno.makeTempFileSync(
    { dir: tempDir, prefix: "r-results", suffix: ".json" },
  );

  const input = JSON.stringify({
    action,
    params,
    results: resultsFile,
    wd: cwd,
  });

  try {
    const result = await execProcess(
      await rBinaryPath("Rscript"),
      {
        args: [resourcePath("rmd/rmd.R")],
        cwd,
        stderr: quiet ? "piped" : "inherit",
      },
      input,
      "stdout>stderr",
      (output) => {
        if (outputFilter) {
          output = outputFilter(output);
        }
        return colors.red(output);
      },
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

function withinActiveRenv() {
  const kRProfile = ".Rprofile";
  const kREnvActivate = 'source("renv/activate.R")';
  if (existsSync(".Rprofile")) {
    const profile = Deno.readTextFileSync(kRProfile);
    return profile.includes(kREnvActivate) &&
      !profile.includes("# " + kREnvActivate);
  } else {
    return false;
  }
}

async function printCallRDiagnostics() {
  const rBin = await checkRBinary();
  if (rBin === undefined) {
    info("");
    info(rInstallationMessage());
    info("");
  } else {
    const caps = await knitrCapabilities(rBin);
    if (caps === undefined) {
      info(
        `Problem with running R found at ${rBin} to check environment configurations.`,
      );
      info("Please check your installation of R.");
      info("");
    } else {
      if (
        !caps?.packages.rmarkdown || !caps?.packages.knitr ||
        !caps?.packages.knitrVersOk || !caps?.packages.rmarkdownVersOk
      ) {
        info("R installation:");
        info(knitrCapabilitiesMessage(caps, "  "));
        if (!!!caps?.packages.knitr || !caps?.packages.knitrVersOk) {
          info("");
          info(
            knitrInstallationMessage(
              "",
              "knitr",
              !!caps.packages.knitr && !caps.packages.knitrVersOk,
            ),
          );
        }
        if (!!!caps?.packages.rmarkdown || !caps?.packages.rmarkdownVersOk) {
          info("");
          info(
            knitrInstallationMessage(
              "",
              "rmarkdown",
              !!caps?.packages.rmarkdown && !caps?.packages.rmarkdownVersOk,
            ),
          );
        }
        info("");
      }
    }
  }
}

function filterAlwaysAllowHtml(s: string): string {
  if (
    s.indexOf(
      "Functions that produce HTML output found in document targeting",
    ) !== -1
  ) {
    s = s
      .replace("your rmarkdown file", "your quarto file")
      .replace("always_allow_html: true", "prefer-html: true");
  }
  return s;
}

function resolveInlineExecute(code: string) {
  return executeInlineCodeHandler(
    "r",
    (expr) => `${"`"}r .QuartoInlineRender(${expr})${"`"}`,
  )(code);
}

export function isKnitrSpinScript(file: string) {
  const ext = extname(file).toLowerCase();
  if (ext == ".r") {
    const text = Deno.readTextFileSync(file);
    // Consider a .R script that can be spinned if it contains a YAML header inside a special `#'` comment
    return /^\s*#'\s*---[\s\S]+?\s*#'\s*---/.test(text);
  } else {
    return false;
  }
}

export async function markdownFromKnitrSpinScript(file: string) {
  // run spin to get .qmd and get markdown from .qmd

  // TODO: implement a caching system because spin is slow and it seems we call this twice for each run
  // 1. First as part of the target() call
  // 2. Second as part of renderProject() call to get `partitioned` information to get `resourcesFrom` with `resourceFilesFromRenderedFile()`

  // we need a temp dir for `CallR` to work but we don't have access to usual options.tempDir.
  const tempDir = globalTempContext().createDir();

  const result = await callR<string>(
    "spin",
    { input: file },
    tempDir,
    undefined,
    true,
  );

  return result;
}
