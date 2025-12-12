/*
 * rmd.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { error, info, warning } from "../deno_ral/log.ts";
import { existsSync } from "../deno_ral/fs.ts";
import { basename, extname } from "../deno_ral/path.ts";

import * as colors from "fmt/colors";

// Import quartoAPI directly since we're in core codebase
import type { QuartoAPI } from "../core/api/index.ts";

let quarto: QuartoAPI;

import { rBinaryPath } from "../core/resources.ts";

import { kCodeLink } from "../config/constants.ts";

import {
  checkRBinary,
  KnitrCapabilities,
  knitrCapabilities,
  knitrCapabilitiesMessage,
  knitrInstallationMessage,
  rInstallationMessage,
  WindowsArmX64RError,
} from "../core/knitr.ts";
import {
  DependenciesOptions,
  DependenciesResult,
  EngineProjectContext,
  ExecuteOptions,
  ExecuteResult,
  ExecutionEngineDiscovery,
  ExecutionEngineInstance,
  ExecutionTarget,
  kKnitrEngine,
  PostProcessOptions,
  RunOptions,
} from "./types.ts";
import type { CheckConfiguration } from "../command/check/check.ts";
import {
  asMappedString,
  mappedIndexToLineCol,
  MappedString,
} from "../core/lib/mapped-text.ts";

const kRmdExtensions = [".rmd", ".rmarkdown"];

export const knitrEngineDiscovery: ExecutionEngineDiscovery = {
  init: (quartoAPI) => {
    quarto = quartoAPI;
  },

  // Discovery methods
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

  canFreeze: true,

  generatesFigures: true,

  ignoreDirs: () => {
    return ["renv", "packrat", "rsconnect"];
  },

  checkInstallation: async (conf: CheckConfiguration) => {
    const kIndent = "      ";

    // Helper functions (inline)
    const checkCompleteMessage = (message: string) => {
      if (!conf.jsonResult) {
        quarto.console.completeMessage(message);
      }
    };
    const checkInfoMsg = (message: string) => {
      if (!conf.jsonResult) {
        info(message);
      }
    };

    // Render check helper (inline)
    const checkKnitrRender = async () => {
      const json: Record<string, unknown> = {};
      if (conf.jsonResult) {
        (conf.jsonResult.render as Record<string, unknown>).knitr = json;
      }

      const result = await quarto.system.checkRender({
        content: `
---
title: "Title"
---

## Header

\`\`\`{r}
1 + 1
\`\`\`
`,
        language: "r",
        services: conf.services,
      });

      if (result.error) {
        if (!conf.jsonResult) {
          throw result.error;
        } else {
          json["error"] = result.error;
        }
      } else {
        json["ok"] = true;
      }
    };

    // Main check logic
    const kMessage = "Checking R installation...........";
    let caps: KnitrCapabilities | undefined;
    let rBin: string | undefined;
    let x64ArmError: WindowsArmX64RError | undefined;
    const json: Record<string, unknown> = {};
    if (conf.jsonResult) {
      (conf.jsonResult.tools as Record<string, unknown>).knitr = json;
    }
    const knitrCb = async () => {
      rBin = await checkRBinary();
      try {
        caps = await knitrCapabilities(rBin);
      } catch (e) {
        if (e instanceof WindowsArmX64RError) {
          x64ArmError = e;
          // Don't rethrow - let caps stay undefined but capture error
        } else {
          throw e; // Rethrow other errors
        }
      }
    };
    if (conf.jsonResult) {
      await knitrCb();
    } else {
      await quarto.console.withSpinner({
        message: kMessage,
        doneMessage: false,
      }, knitrCb);
    }
    if (rBin && caps) {
      checkCompleteMessage(kMessage + "OK");
      if (conf.jsonResult) {
        json["capabilities"] = caps;
      } else {
        checkInfoMsg(knitrCapabilitiesMessage(caps, kIndent));
      }
      checkInfoMsg("");
      if (caps.packages.rmarkdownVersOk && caps.packages.knitrVersOk) {
        const kKnitrMessage = "Checking Knitr engine render......";
        if (conf.jsonResult) {
          await checkKnitrRender();
        } else {
          await quarto.console.withSpinner({
            message: kKnitrMessage,
            doneMessage: kKnitrMessage + "OK\n",
          }, async () => {
            await checkKnitrRender();
          });
        }
      } else {
        // show install message if not available
        // or update message if not up to date
        json["installed"] = false;
        if (!caps.packages.knitr || !caps.packages.knitrVersOk) {
          const msg = knitrInstallationMessage(
            kIndent,
            "knitr",
            !!caps.packages.knitr && !caps.packages.knitrVersOk,
          );
          checkInfoMsg(msg);
          json["how-to-install-knitr"] = msg;
        }
        if (!caps.packages.rmarkdown || !caps.packages.rmarkdownVersOk) {
          const msg = knitrInstallationMessage(
            kIndent,
            "rmarkdown",
            !!caps.packages.rmarkdown && !caps.packages.rmarkdownVersOk,
          );
          checkInfoMsg(msg);
          json["how-to-install-rmarkdown"] = msg;
        }
        checkInfoMsg("");
      }
    } else if (rBin === undefined) {
      checkCompleteMessage(kMessage + "(None)\n");
      const msg = rInstallationMessage(kIndent);
      checkInfoMsg(msg);
      json["installed"] = false;
      checkInfoMsg("");
    } else if (x64ArmError) {
      // x64 R on Windows ARM detected - show specific error
      json["installed"] = false;
      checkCompleteMessage(kMessage + "(None)\n");
      const errorLines = x64ArmError.message.split("\n");
      errorLines.forEach((line) => {
        checkInfoMsg(line);
      });
      json["error"] = x64ArmError.message;
      checkInfoMsg("");
    } else if (caps === undefined) {
      json["installed"] = false;
      checkCompleteMessage(kMessage + "(None)\n");
      const msgs = [
        `R succesfully found at ${rBin}.`,
        "However, a problem was encountered when checking configurations of packages.",
        "Please check your installation of R.",
      ];
      msgs.forEach((msg) => {
        checkInfoMsg(msg);
      });
      json["error"] = msgs.join("\n");
      checkInfoMsg("");
    }
  },

  // Launch method that returns an instance with context closure
  launch: (context: EngineProjectContext): ExecutionEngineInstance => {
    return {
      // Instance properties (required by interface)
      name: kKnitrEngine,
      canFreeze: true,

      // Instance methods
      async markdownForFile(file: string): Promise<MappedString> {
        const isSpin = isKnitrSpinScript(file);
        if (isSpin) {
          return asMappedString(await markdownFromKnitrSpinScript(file));
        }
        return quarto.mappedString.fromFile(file);
      },

      target: async (
        file: string,
        _quiet?: boolean,
        markdown?: MappedString,
      ): Promise<ExecutionTarget | undefined> => {
        const resolvedMarkdown = await context.resolveFullMarkdownForFile(
          knitrEngineDiscovery.launch(context),
          file,
          markdown,
        );
        let metadata;
        try {
          metadata = quarto.markdownRegex.extractYaml(resolvedMarkdown.value);
        } catch (e) {
          if (!(e instanceof Error)) throw e;
          error(`Error reading metadata from ${file}.\n${e.message}`);
          throw e;
        }
        const target: ExecutionTarget = {
          source: file,
          input: file,
          markdown: resolvedMarkdown,
          metadata,
        };
        return Promise.resolve(target);
      },

      partitionedMarkdown: async (file: string) => {
        if (isKnitrSpinScript(file)) {
          return quarto.markdownRegex.partition(
            await markdownFromKnitrSpinScript(file),
          );
        } else {
          return quarto.markdownRegex.partition(Deno.readTextFileSync(file));
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
          options.project?.isSingleFile ? undefined : options.projectDir,
          options.quiet,
          // fixup .rmarkdown file references
          (output) => {
            output = output.replaceAll(
              `${inputStem}.rmarkdown`,
              () => inputBasename,
            );

            const m = output.match(/^Quitting from lines (\d+)-(\d+)/m);
            if (m) {
              const f1 = quarto.text.lineColToIndex(
                options.target.markdown.value,
              );
              const f2 = mappedIndexToLineCol(options.target.markdown);

              const newLine1 = f2(f1({ line: Number(m[1]) - 1, column: 0 }))
                .line + 1;
              const newLine2 = f2(f1({ line: Number(m[2]) - 1, column: 0 }))
                .line + 1;
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
        quarto.text.postProcessRestorePreservedHtml(options);

        // see if we can code link
        if (options.format.render?.[kCodeLink]) {
          // When using shiny document, code-link proceesing is not supported
          // https://github.com/quarto-dev/quarto-cli/issues/9208
          if (quarto.format.isServerShiny(options.format)) {
            warning(
              `'code-link' option will be ignored as it is not supported for 'server: shiny' due to 'downlit' R package limitation (https://github.com/quarto-dev/quarto-cli/issues/9208).`,
            );
            return Promise.resolve();
          }
          // Current knitr engine postprocess is all about applying downlit processing to the HTML output
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

  // QUARTO_KNITR_RSCRIPT_ARGS allows to pass additional arguments to Rscript as comma separated values
  // e.g. QUARTO_KNITR_RSCRIPT_ARGS="--vanilla,--no-init-file,--max-connections=258"
  const rscriptArgs = Deno.env.get("QUARTO_KNITR_RSCRIPT_ARGS") || "";
  const rscriptArgsArray = rscriptArgs.split(",").filter((a) =>
    a.trim() !== ""
  );

  try {
    const result = await quarto.system.execProcess(
      {
        cmd: await rBinaryPath("Rscript"),
        args: [
          ...rscriptArgsArray,
          quarto.path.resource("rmd/rmd.R"),
        ],
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
    if (!(e instanceof Error)) {
      throw e;
    }
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
  return quarto.text.executeInlineCodeHandler(
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
  const tempDir = quarto.system.tempContext().createDir();

  const result = await callR<string>(
    "spin",
    { input: file },
    tempDir,
    undefined,
    true,
  );

  return result;
}
