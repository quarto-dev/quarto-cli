/*
 * jupyter.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { basename, dirname, join, relative } from "../../deno_ral/path.ts";
import { satisfies } from "semver/mod.ts";

import { existsSync } from "../../deno_ral/fs.ts";
import { normalizePath } from "../../core/path.ts";

import { error, info } from "../../deno_ral/log.ts";

import * as ld from "../../core/lodash.ts";

import {
  kBaseFormat,
  kExecuteDaemon,
  kExecuteEnabled,
  kExecuteIpynb,
  kFigDpi,
  kFigFormat,
  kFigPos,
  kIncludeAfterBody,
  kIncludeInHeader,
  kIpynbFilters,
  kIpynbProduceSourceNotebook,
  kKeepHidden,
  kKeepIpynb,
  kNotebookPreserveCells,
  kRemoveHidden,
} from "../../config/constants.ts";
import { Format } from "../../config/types.ts";

import {
  executeKernelKeepalive,
  executeKernelOneshot,
  JupyterExecuteOptions,
} from "./jupyter-kernel.ts";
import {
  JupyterCapabilities,
  JupyterKernelspec,
  JupyterNotebook,
  JupyterWidgetDependencies,
} from "../../core/jupyter/types.ts";

import { RenderOptions, RenderResultFile } from "../../command/render/types.ts";
import {
  DependenciesOptions,
  EngineProjectContext,
  ExecuteOptions,
  ExecuteResult,
  ExecutionEngineDiscovery,
  ExecutionEngineInstance,
  ExecutionTarget,
  kJupyterEngine,
  kQmdExtensions,
  PandocIncludes,
  PostProcessOptions,
  RunOptions,
} from "../types.ts";

// Target data interface used by Jupyter
interface JupyterTargetData {
  transient: boolean;
  kernelspec: JupyterKernelspec;
}

// Import quartoAPI directly since we're in core codebase
import type { QuartoAPI } from "../../core/api/index.ts";

let quarto: QuartoAPI;
import { MappedString } from "../../core/mapped-text.ts";
import { kJupyterPercentScriptExtensions } from "../../core/jupyter/percent.ts";
import type { CheckConfiguration } from "../../command/check/check.ts";

export const jupyterEngineDiscovery: ExecutionEngineDiscovery = {
  init: (quartoAPI) => {
    quarto = quartoAPI;
  },

  name: kJupyterEngine,
  defaultExt: ".qmd",
  defaultYaml: (kernel?: string) => [
    `jupyter: ${kernel || "python3"}`,
  ],
  defaultContent: (kernel?: string) => {
    kernel = kernel || "python3";
    const lang = kernel.startsWith("python")
      ? "python"
      : kernel.startsWith("julia")
      ? "julia"
      : undefined;
    if (lang) {
      return [
        "```{" + lang + "}",
        "1 + 1",
        "```",
      ];
    } else {
      return [];
    }
  },
  validExtensions: () => [
    ...quarto.jupyter.notebookExtensions,
    ...kJupyterPercentScriptExtensions,
    ...kQmdExtensions,
  ],
  claimsFile: (file: string, ext: string) => {
    return quarto.jupyter.notebookExtensions.includes(ext.toLowerCase()) ||
      quarto.jupyter.isPercentScript(file);
  },
  claimsLanguage: (language: string) => {
    // jupyter has to claim julia so that julia may also claim it without changing the old behavior
    // of preferring jupyter over julia engine by default
    return language.toLowerCase() === "julia";
  },
  canFreeze: true,
  generatesFigures: true,
  ignoreDirs: () => {
    return ["venv", "env"];
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
    const checkJupyterRender = async () => {
      const json: Record<string, unknown> = {};
      if (conf.jsonResult) {
        (conf.jsonResult.render as Record<string, unknown>).jupyter = json;
      }

      const result = await quarto.system.checkRender({
        content: `
---
title: "Title"
---

## Header

\`\`\`{python}
1 + 1
\`\`\`
`,
        language: "python",
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
    const kMessage = "Checking Python 3 installation....";
    const jupyterJson: Record<string, unknown> = {};
    if (conf.jsonResult) {
      (conf.jsonResult.tools as Record<string, unknown>).jupyter = jupyterJson;
    }
    let caps: JupyterCapabilities | undefined;
    if (conf.jsonResult) {
      caps = await quarto.jupyter.capabilities();
    } else {
      await quarto.console.withSpinner({
        message: kMessage,
        doneMessage: false,
      }, async () => {
        caps = await quarto.jupyter.capabilities();
      });
    }
    if (caps) {
      checkCompleteMessage(kMessage + "OK");
      if (conf.jsonResult) {
        jupyterJson["capabilities"] = await quarto.jupyter.capabilitiesJson(
          caps,
        );
      } else {
        checkInfoMsg(await quarto.jupyter.capabilitiesMessage(caps, kIndent));
      }
      checkInfoMsg("");
      if (caps.jupyter_core) {
        if (await quarto.jupyter.kernelspecForLanguage("python")) {
          const kJupyterMessage = "Checking Jupyter engine render....";
          if (conf.jsonResult) {
            await checkJupyterRender();
          } else {
            await quarto.console.withSpinner({
              message: kJupyterMessage,
              doneMessage: kJupyterMessage + "OK\n",
            }, async () => {
              await checkJupyterRender();
            });
          }
        } else {
          jupyterJson["kernels"] = [];
          checkInfoMsg(
            kIndent + "NOTE: No Jupyter kernel for Python found",
          );
          checkInfoMsg("");
        }
      } else {
        const installMessage = quarto.jupyter.installationMessage(
          caps,
          kIndent,
        );
        checkInfoMsg(installMessage);
        checkInfoMsg("");
        jupyterJson["installed"] = false;
        jupyterJson["how-to-install"] = installMessage;
        const envMessage = quarto.jupyter.unactivatedEnvMessage(caps, kIndent);
        if (envMessage) {
          checkInfoMsg(envMessage);
          checkInfoMsg("");
          jupyterJson["env"] = {
            "warning": envMessage,
          };
        }
      }
    } else {
      checkCompleteMessage(kMessage + "(None)\n");
      const msg = quarto.jupyter.pythonInstallationMessage(kIndent);
      jupyterJson["installed"] = false;
      jupyterJson["how-to-install-python"] = msg;
      checkInfoMsg(msg);
      checkInfoMsg("");
    }
  },

  // Launch method will return an instance with context
  launch: (context: EngineProjectContext): ExecutionEngineInstance => {
    return {
      name: jupyterEngineDiscovery.name,
      canFreeze: jupyterEngineDiscovery.canFreeze,

      markdownForFile: (file: string): Promise<MappedString> => {
        if (quarto.jupyter.isJupyterNotebook(file)) {
          const nbJSON = Deno.readTextFileSync(file);
          const nb = quarto.jupyter.fromJSON(nbJSON);
          return Promise.resolve(
            quarto.mappedString.fromString(
              quarto.jupyter.markdownFromNotebookJSON(nb),
            ),
          );
        } else if (quarto.jupyter.isPercentScript(file)) {
          return Promise.resolve(
            quarto.mappedString.fromString(
              quarto.jupyter.percentScriptToMarkdown(file),
            ),
          );
        } else {
          return Promise.resolve(quarto.mappedString.fromFile(file));
        }
      },

      target: async (
        file: string,
        quiet?: boolean,
        markdown?: MappedString,
      ): Promise<ExecutionTarget | undefined> => {
        if (!markdown) {
          markdown = await context.resolveFullMarkdownForFile(undefined, file);
        }

        // at some point we'll resolve a full notebook/kernelspec
        let nb: JupyterNotebook | undefined;
        if (quarto.jupyter.isJupyterNotebook(file)) {
          const nbJSON = Deno.readTextFileSync(file);
          const nbRaw = JSON.parse(nbJSON);

          // https://github.com/quarto-dev/quarto-cli/issues/12374
          // kernelspecs are not guaranteed to have a language field
          // so we need to check for it and if not present
          // use the language_info.name field
          if (
            nbRaw.metadata.kernelspec &&
            nbRaw.metadata.kernelspec.language === undefined &&
            nbRaw.metadata.language_info?.name
          ) {
            nbRaw.metadata.kernelspec.language =
              nbRaw.metadata.language_info.name;
          }
          nb = nbRaw as JupyterNotebook;
        }

        // cache check for percent script
        const isPercentScript = quarto.jupyter.isPercentScript(file);

        // get the metadata
        const metadata = quarto.markdownRegex.extractYaml(markdown!.value);

        // if this is a text markdown file then create a notebook for use as the execution target
        if (quarto.path.isQmdFile(file) || isPercentScript) {
          // write a transient notebook
          const [fileDir, fileStem] = quarto.path.dirAndStem(file);
          // See #4802
          // I don't love using an extension other than .ipynb for this file,
          // but doing something like .quarto.ipynb would require a lot
          // of additional changes to our file handling code (without changes,
          // our output files would be called $FILE.quarto.html, which
          // is not what we want). So for now, we'll use .quarto_ipynb
          let counter: number | undefined = undefined;
          let notebook = join(
            fileDir,
            `${fileStem}.quarto_ipynb${counter ? "_" + String(counter) : ""}`,
          );

          while (existsSync(notebook)) {
            if (!counter) {
              counter = 1;
            } else {
              ++counter;
            }
            notebook = join(
              fileDir,
              `${fileStem}.quarto_ipynb${counter ? "_" + String(counter) : ""}`,
            );
          }
          const target = {
            source: file,
            input: notebook,
            markdown: markdown!,
            metadata,
            data: { transient: true, kernelspec: {} },
          };
          nb = await createNotebookforTarget(target);
          target.data.kernelspec = nb.metadata.kernelspec;
          return target;
        } else if (quarto.jupyter.isJupyterNotebook(file)) {
          return {
            source: file,
            input: file,
            markdown: markdown!,
            metadata,
            data: { transient: false, kernelspec: nb?.metadata.kernelspec },
          };
        } else {
          return undefined;
        }
      },

      partitionedMarkdown: async (file: string, format?: Format) => {
        if (quarto.jupyter.isJupyterNotebook(file)) {
          return quarto.markdownRegex.partition(
            await quarto.jupyter.markdownFromNotebookFile(file, format),
          );
        } else if (quarto.jupyter.isPercentScript(file)) {
          return quarto.markdownRegex.partition(
            quarto.jupyter.percentScriptToMarkdown(file),
          );
        } else {
          return quarto.markdownRegex.partition(Deno.readTextFileSync(file));
        }
      },

      filterFormat: (
        source: string,
        options: RenderOptions,
        format: Format,
      ) => {
        // if this is shiny server and the user hasn't set keep-hidden then
        // set it as well as the attibutes required to remove the hidden blocks
        if (
          quarto.format.isServerShinyPython(format, kJupyterEngine) &&
          format.render[kKeepHidden] !== true
        ) {
          format = {
            ...format,
            render: {
              ...format.render,
            },
            metadata: {
              ...format.metadata,
            },
          };
          format.render[kKeepHidden] = true;
          format.metadata[kRemoveHidden] = "all";
        }

        if (quarto.jupyter.isJupyterNotebook(source)) {
          // see if we want to override execute enabled
          let executeEnabled: boolean | null | undefined;

          // we never execute for a dev server reload
          if (options.devServerReload) {
            executeEnabled = false;

            // if a specific ipynb execution policy is set then reflect it
          } else if (typeof (format.execute[kExecuteIpynb]) === "boolean") {
            executeEnabled = format.execute[kExecuteIpynb];

            // if a specific execution policy is set then reflect it
          } else if (typeof (format.execute[kExecuteEnabled]) == "boolean") {
            executeEnabled = format.execute[kExecuteEnabled];

            // otherwise default to NOT executing
          } else {
            executeEnabled = false;
          }

          // return format w/ execution policy
          if (executeEnabled !== undefined) {
            return {
              ...format,
              execute: {
                ...format.execute,
                [kExecuteEnabled]: executeEnabled,
              },
            };
            // otherwise just return the original format
          } else {
            return format;
          }
          // not an ipynb
        } else {
          return format;
        }
      },

      execute: async (options: ExecuteOptions): Promise<ExecuteResult> => {
        // create the target input if we need to (could have been removed
        // by the cleanup step of another render in this invocation)
        if (
          (quarto.path.isQmdFile(options.target.source) ||
            quarto.jupyter.isPercentScript(options.target.source)) &&
          !existsSync(options.target.input)
        ) {
          await createNotebookforTarget(options.target);
        }

        // determine the kernel (it's in the custom execute options data)
        let kernelspec = (options.target.data as JupyterTargetData).kernelspec;

        // determine execution behavior
        const execute = options.format.execute[kExecuteEnabled] !== false;
        if (execute) {
          // if yaml front matter has a different kernel then use it
          if (quarto.jupyter.isJupyterNotebook(options.target.source)) {
            kernelspec =
              await ensureYamlKernelspec(options.target, kernelspec) ||
              kernelspec;
          }

          // jupyter back end requires full path to input (to ensure that
          // keepalive kernels are never re-used across multiple inputs
          // that happen to share a hash)
          const execOptions = {
            ...options,
            target: {
              ...options.target,
              input: quarto.path.absolute(options.target.input),
            },
          };

          // use daemon by default if we are in an interactive session (terminal
          // or rstudio) and not running in a CI system.
          let executeDaemon = options.format.execute[kExecuteDaemon];
          if (executeDaemon === null || executeDaemon === undefined) {
            if (await disableDaemonForNotebook(options.target)) {
              executeDaemon = false;
            } else {
              executeDaemon = quarto.system.isInteractiveSession() &&
                !quarto.system.runningInCI();
            }
          }
          const jupyterExecOptions: JupyterExecuteOptions = {
            kernelspec,
            python_cmd: await quarto.jupyter.pythonExec(kernelspec),
            supervisor_pid: options.previewServer ? Deno.pid : undefined,
            ...execOptions,
          };
          if (executeDaemon === false || executeDaemon === 0) {
            await executeKernelOneshot(jupyterExecOptions);
          } else {
            await executeKernelKeepalive(jupyterExecOptions);
          }
        }

        // convert to markdown and write to target (only run notebook filters
        // if the source is an ipynb file)
        const nbContents = await quarto.jupyter.notebookFiltered(
          options.target.input,
          quarto.jupyter.isJupyterNotebook(options.target.source)
            ? (options.format.execute[kIpynbFilters] as string[] || [])
            : [],
        );

        const nb = quarto.jupyter.fromJSON(nbContents);

        // cells tagged 'shinylive' should be emmited as markdown
        fixupShinyliveCodeCells(nb);

        const assets = quarto.jupyter.assets(
          options.target.input,
          options.format.pandoc.to,
        );

        // Preserve the cell metadata if users have asked us to, or if this is dashboard
        // that is coming from a non-qmd source
        const preserveCellMetadata =
          options.format.render[kNotebookPreserveCells] === true ||
          (quarto.format.isHtmlDashboardOutput(
            options.format.identifier[kBaseFormat],
          ) &&
            !quarto.path.isQmdFile(options.target.source));

        // NOTE: for perforance reasons the 'nb' is mutated in place
        // by jupyterToMarkdown (we don't want to make a copy of a
        // potentially very large notebook) so should not be relied
        // on subseuqent to this call
        const result = await quarto.jupyter.toMarkdown(
          nb,
          {
            executeOptions: options,
            language: nb.metadata.kernelspec.language.toLowerCase(),
            assets,
            execute: options.format.execute,
            keepHidden: options.format.render[kKeepHidden],
            toHtml: quarto.format.isHtmlCompatible(options.format),
            toLatex: quarto.format.isLatexOutput(options.format.pandoc),
            toMarkdown: quarto.format.isMarkdownOutput(options.format),
            toIpynb: quarto.format.isIpynbOutput(options.format.pandoc),
            toPresentation: quarto.format.isPresentationOutput(
              options.format.pandoc,
            ),
            figFormat: options.format.execute[kFigFormat],
            figDpi: options.format.execute[kFigDpi],
            figPos: options.format.render[kFigPos],
            preserveCellMetadata,
            preserveCodeCellYaml:
              options.format.render[kIpynbProduceSourceNotebook] === true,
          },
        );

        // return dependencies as either includes or raw dependencies
        let includes: PandocIncludes | undefined;
        let engineDependencies: Record<string, Array<unknown>> | undefined;
        if (options.dependencies) {
          includes = quarto.jupyter.resultIncludes(
            options.tempDir,
            result.dependencies,
          );
        } else {
          const dependencies = quarto.jupyter.resultEngineDependencies(
            result.dependencies,
          );
          if (dependencies) {
            engineDependencies = {
              [kJupyterEngine]: dependencies,
            };
          }
        }

        // if it's a transient notebook then remove it
        // (unless keep-ipynb was specified)
        cleanupNotebook(options.target, options.format, context);

        // Create markdown from the result
        const outputs = result.cellOutputs.map((output) => output.markdown);
        if (result.notebookOutputs) {
          if (result.notebookOutputs.prefix) {
            outputs.unshift(result.notebookOutputs.prefix);
          }
          if (result.notebookOutputs.suffix) {
            outputs.push(result.notebookOutputs.suffix);
          }
        }
        const markdown = outputs.join("");

        // return results
        return {
          engine: kJupyterEngine,
          markdown: markdown,
          supporting: [join(assets.base_dir, assets.supporting_dir)],
          filters: [],
          pandoc: result.pandoc,
          includes,
          engineDependencies,
          preserve: result.htmlPreserve,
          postProcess: result.htmlPreserve &&
            (Object.keys(result.htmlPreserve).length > 0),
        };
      },

      executeTargetSkipped: (target: ExecutionTarget, format: Format) => {
        cleanupNotebook(target, format, context);
      },

      dependencies: (options: DependenciesOptions) => {
        const includes: PandocIncludes = {};
        if (options.dependencies) {
          const includeFiles = quarto.jupyter.widgetDependencyIncludes(
            options.dependencies as JupyterWidgetDependencies[],
            options.tempDir,
          );
          if (includeFiles.inHeader) {
            includes[kIncludeInHeader] = [includeFiles.inHeader];
          }
          if (includeFiles.afterBody) {
            includes[kIncludeAfterBody] = [includeFiles.afterBody];
          }
        }
        return Promise.resolve({
          includes,
        });
      },

      postprocess: (options: PostProcessOptions) => {
        quarto.text.postProcessRestorePreservedHtml(options);
        return Promise.resolve();
      },

      canKeepSource: (target: ExecutionTarget) => {
        return !quarto.jupyter.isJupyterNotebook(target.source);
      },

      intermediateFiles: (input: string) => {
        const files: string[] = [];
        const [fileDir, fileStem] = quarto.path.dirAndStem(input);

        if (!quarto.jupyter.isJupyterNotebook(input)) {
          files.push(join(fileDir, fileStem + ".ipynb"));
        } else if (
          [...kQmdExtensions, ...kJupyterPercentScriptExtensions].some(
            (ext) => {
              return existsSync(join(fileDir, fileStem + ext));
            },
          )
        ) {
          files.push(input);
        }
        return files;
      },

      run: async (options: RunOptions): Promise<void> => {
        // semver doesn't support 4th component
        const asSemVer = (version: string) => {
          const v = version.split(".");
          if (v.length > 3) {
            return `${v[0]}.${v[1]}.${v[2]}`;
          } else {
            return version;
          }
        };

        // confirm required version of shiny
        const kShinyVersion = ">=0.6";
        let shinyError: string | undefined;
        const caps = await quarto.jupyter.capabilities();
        if (!caps?.shiny) {
          shinyError =
            "The shiny package is required for documents with server: shiny";
        } else if (
          !satisfies(asSemVer(caps.shiny), asSemVer(kShinyVersion))
        ) {
          shinyError =
            `The shiny package version must be ${kShinyVersion} for documents with server: shiny`;
        }
        if (shinyError) {
          shinyError +=
            "\n\nInstall the latest version of shiny with pip install --upgrade shiny\n";
          error(shinyError);
          throw new Error();
        }

        const [_dir] = quarto.path.dirAndStem(options.input);
        const appFile = "app.py";
        const cmd = [
          ...await quarto.jupyter.pythonExec(),
          "-m",
          "shiny",
          "run",
          appFile,
          "--host",
          options.host!,
          "--port",
          String(options.port!),
        ];
        if (options.reload) {
          cmd.push("--reload");
          cmd.push(`--reload-includes=*.py`);
        }

        // start server
        const readyPattern =
          /(http:\/\/(?:localhost|127\.0\.0\.1)\:\d+\/?[^\s]*)/;
        const server = quarto.system.runExternalPreviewServer({
          cmd,
          readyPattern,
          cwd: dirname(options.input),
        });
        await server.start();

        // stop the server onCleanup
        quarto.system.onCleanup(async () => {
          await server.stop();
        });

        // notify when ready
        if (options.onReady) {
          options.onReady();
        }

        // run the server
        return server.serve();
      },

      postRender: async (file: RenderResultFile) => {
        // discover non _files dir resources for server: shiny and amend app.py with them
        if (quarto.format.isServerShiny(file.format)) {
          const [dir] = quarto.path.dirAndStem(file.input);
          const filesDir = join(dir, quarto.path.inputFilesDir(file.input));
          const extraResources = file.resourceFiles
            .filter((resource) => !resource.startsWith(filesDir))
            .map((resource) => relative(dir, resource));
          const appScriptDir = context ? context.getOutputDirectory() : dir;
          const appScript = join(appScriptDir, `app.py`);
          if (existsSync(appScript)) {
            // compute static assets
            const staticAssets = [
              quarto.path.inputFilesDir(file.input),
              ...extraResources,
            ];

            // check for (illegal) parent dir assets
            const parentDirAssets = staticAssets.filter((asset) =>
              asset.startsWith("..")
            );
            if (parentDirAssets.length > 0) {
              error(
                `References to files in parent directories found in document with server: shiny ` +
                  `(${basename(file.input)}): ${
                    JSON.stringify(parentDirAssets)
                  }. All resource files referenced ` +
                  `by Shiny documents must exist in the same directory as the source file.`,
              );
              throw new Error();
            }

            // In the app.py file, replace the placeholder with the list of static assets.
            let appContents = Deno.readTextFileSync(appScript);
            appContents = appContents.replace(
              "##STATIC_ASSETS_PLACEHOLDER##",
              JSON.stringify(staticAssets),
            );
            Deno.writeTextFileSync(appScript, appContents);
          }
        }
      },
    };
  },
};

async function ensureYamlKernelspec(
  target: ExecutionTarget,
  kernelspec: JupyterKernelspec,
) {
  const markdown = target.markdown.value;
  const yamlJupyter = quarto.markdownRegex.extractYaml(markdown)?.jupyter;
  if (yamlJupyter && typeof yamlJupyter !== "boolean") {
    const [yamlKernelspec, _] = await quarto.jupyter.kernelspecFromMarkdown(
      markdown,
    );
    if (yamlKernelspec.name !== kernelspec?.name) {
      const nb = quarto.jupyter.fromJSON(Deno.readTextFileSync(target.source));
      nb.metadata.kernelspec = yamlKernelspec;
      Deno.writeTextFileSync(target.source, JSON.stringify(nb, null, 2));
      return yamlKernelspec;
    }
  }
}

function fixupShinyliveCodeCells(nb: JupyterNotebook) {
  if (nb.metadata.kernelspec.language === "python") {
    nb.cells.forEach((cell) => {
      if (
        cell.cell_type === "code" && cell.metadata.tags?.includes("shinylive")
      ) {
        cell.cell_type = "markdown";
        cell.metadata = {};
        cell.source = [
          "```{shinylive-python}\n",
          ...cell.source,
          "\n```",
        ];
        delete cell.execution_count;
        delete cell.outputs;
      }
    });
  }
}

async function createNotebookforTarget(
  target: ExecutionTarget,
  project?: EngineProjectContext,
) {
  const nb = await quarto.jupyter.quartoMdToJupyter(
    target.markdown.value,
    true,
    project,
  );
  Deno.writeTextFileSync(target.input, JSON.stringify(nb, null, 2));
  return nb;
}

// mitigate conflict between pexpect and our daamonization, see
// https://github.com/quarto-dev/quarto-cli/discussions/728
async function disableDaemonForNotebook(target: ExecutionTarget) {
  const kShellMagics = [
    "cd",
    "cat",
    "cp",
    "env",
    "ls",
    "man",
    "mkdir",
    "more",
    "mv",
    "pwd",
    "rm",
    "rmdir",
  ];
  const nb = await quarto.markdownRegex.breakQuartoMd(target.markdown);
  for (const cell of nb.cells) {
    if (ld.isObject(cell.cell_type)) {
      const language = (cell.cell_type as { language: string }).language;
      if (language === "python") {
        if (cell.source.value.startsWith("!")) {
          return true;
        }
        return (kShellMagics.some((cmd) =>
          cell.source.value.includes("%" + cmd + " ") ||
          cell.source.value.includes("!" + cmd + " ") ||
          cell.source.value.startsWith(cmd + " ")
        ));
      }
    }
  }

  return false;
}

function cleanupNotebook(
  target: ExecutionTarget,
  format: Format,
  project: EngineProjectContext,
) {
  // Make notebook non-transient when keep-ipynb is set
  const data = target.data as JupyterTargetData;
  const normalizedSource = normalizePath(target.source);
  const cached = project.fileInformationCache.get(normalizedSource);
  if (cached && data.transient && format.execute[kKeepIpynb]) {
    if (cached.target && cached.target.data) {
      (cached.target.data as JupyterTargetData).transient = false;
    }
  }
}

interface JupyterTargetData {
  transient: boolean;
  kernelspec: JupyterKernelspec;
}
