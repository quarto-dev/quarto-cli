/*
 * jupyter.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { dirname, join, relative } from "path/mod.ts";

import { existsSync } from "fs/mod.ts";

import * as ld from "../../core/lodash.ts";

import { readYamlFromMarkdown } from "../../core/yaml.ts";
import { isInteractiveSession } from "../../core/platform.ts";
import { partitionMarkdown } from "../../core/pandoc/pandoc-partition.ts";

import { dirAndStem, normalizePath, removeIfExists } from "../../core/path.ts";
import { runningInCI } from "../../core/ci-info.ts";

import {
  isJupyterNotebook,
  jupyterAssets,
  jupyterFromJSON,
  jupyterKernelspecFromMarkdown,
  jupyterToMarkdown,
  kJupyterNotebookExtensions,
  quartoMdToJupyter,
} from "../../core/jupyter/jupyter.ts";
import {
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
  isHtmlCompatible,
  isIpynbOutput,
  isLatexOutput,
  isMarkdownOutput,
  isPresentationOutput,
} from "../../config/format.ts";

import {
  executeKernelKeepalive,
  executeKernelOneshot,
  JupyterExecuteOptions,
} from "./jupyter-kernel.ts";
import {
  JupyterKernelspec,
  JupyterNotebook,
  JupyterWidgetDependencies,
} from "../../core/jupyter/types.ts";
import {
  includesForJupyterWidgetDependencies,
} from "../../core/jupyter/widgets.ts";

import { RenderOptions, RenderResultFile } from "../../command/render/types.ts";
import {
  DependenciesOptions,
  ExecuteOptions,
  ExecuteResult,
  ExecutionEngine,
  ExecutionTarget,
  kJupyterEngine,
  kQmdExtensions,
  PandocIncludes,
  PostProcessOptions,
  RunOptions,
} from "../types.ts";
import { postProcessRestorePreservedHtml } from "../engine-shared.ts";
import { pythonExec } from "../../core/jupyter/exec.ts";

import {
  jupyterNotebookFiltered,
  markdownFromNotebookFile,
  markdownFromNotebookJSON,
} from "../../core/jupyter/jupyter-filters.ts";
import { asMappedString } from "../../core/lib/mapped-text.ts";
import { MappedString, mappedStringFromFile } from "../../core/mapped-text.ts";
import { breakQuartoMd } from "../../core/lib/break-quarto-md.ts";
import { ProjectContext } from "../../project/types.ts";
import { isQmdFile } from "../qmd.ts";
import {
  isJupyterPercentScript,
  kJupyterPercentScriptExtensions,
  markdownFromJupyterPercentScript,
} from "./percent.ts";
import { execProcess } from "../../core/process.ts";
import { inputFilesDir, isServerShinyPython } from "../../core/render.ts";

export const jupyterEngine: ExecutionEngine = {
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
    ...kJupyterNotebookExtensions,
    ...kJupyterPercentScriptExtensions,
    ...kQmdExtensions,
  ],

  claimsFile: (file: string, ext: string) => {
    return kJupyterNotebookExtensions.includes(ext.toLowerCase()) ||
      isJupyterPercentScript(file);
  },

  claimsLanguage: (_language: string) => {
    return false;
  },

  target: async (
    file: string,
    _quiet?: boolean,
    markdown?: MappedString,
    project?: ProjectContext,
  ): Promise<ExecutionTarget | undefined> => {
    // at some point we'll resolve a full notebook/kernelspec
    let nb: JupyterNotebook | undefined;

    // cache check for percent script
    const isPercentScript = isJupyterPercentScript(file);

    if (markdown === undefined) {
      if (isJupyterNotebook(file)) {
        const nbJSON = Deno.readTextFileSync(file);
        nb = JSON.parse(nbJSON) as JupyterNotebook;
        markdown = asMappedString(markdownFromNotebookJSON(nb));
      } else if (isPercentScript) {
        markdown = asMappedString(markdownFromJupyterPercentScript(file));
      } else {
        markdown = asMappedString(mappedStringFromFile(file));
      }
    }

    // get the metadata
    const metadata = readYamlFromMarkdown(markdown.value);

    // if this is a text markdown file then create a notebook for use as the execution target
    if (isQmdFile(file) || isPercentScript) {
      // write a transient notebook
      const [fileDir, fileStem] = dirAndStem(file);
      const notebook = join(fileDir, fileStem + ".ipynb");
      const target = {
        source: file,
        input: notebook,
        markdown,
        metadata,
        data: { transient: true, kernelspec: {} },
      };
      nb = await createNotebookforTarget(target, project);
      target.data.kernelspec = nb.metadata.kernelspec;
      return target;
    } else if (isJupyterNotebook(file)) {
      return {
        source: file,
        input: file,
        markdown,
        metadata,
        data: { transient: false, kernelspec: nb?.metadata.kernelspec },
      };
    } else {
      return undefined;
    }
  },

  partitionedMarkdown: async (file: string, format?: Format) => {
    if (isJupyterNotebook(file)) {
      return partitionMarkdown(await markdownFromNotebookFile(file, format));
    } else if (isJupyterPercentScript(file)) {
      return partitionMarkdown(markdownFromJupyterPercentScript(file));
    } else {
      return partitionMarkdown(Deno.readTextFileSync(file));
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
      isServerShinyPython(format, kJupyterEngine) &&
      format.render[kKeepHidden] !== true
    ) {
      format = ld.cloneDeep(format);
      format.render[kKeepHidden] = true;
      format.metadata[kRemoveHidden] = "all";
    }

    if (isJupyterNotebook(source)) {
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
      (isQmdFile(options.target.source) ||
        isJupyterPercentScript(options.target.source)) &&
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
      if (isJupyterNotebook(options.target.source)) {
        kernelspec = await ensureYamlKernelspec(options.target, kernelspec) ||
          kernelspec;
      }

      // jupyter back end requires full path to input (to ensure that
      // keepalive kernels are never re-used across multiple inputs
      // that happen to share a hash)
      const execOptions = {
        ...options,
        target: {
          ...options.target,
          input: normalizePath(options.target.input),
        },
      };

      // use daemon by default if we are in an interactive session (terminal
      // or rstudio) and not running in a CI system.
      let executeDaemon = options.format.execute[kExecuteDaemon];
      if (executeDaemon === null || executeDaemon === undefined) {
        if (await disableDaemonForNotebook(options.target)) {
          executeDaemon = false;
        } else {
          executeDaemon = isInteractiveSession() && !runningInCI();
        }
      }
      const jupyterExecOptions: JupyterExecuteOptions = {
        kernelspec,
        python_cmd: await pythonExec(kernelspec),
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
    const nbContents = await jupyterNotebookFiltered(
      options.target.input,
      isJupyterNotebook(options.target.source)
        ? options.format.execute[kIpynbFilters]
        : [],
    );

    const nb = jupyterFromJSON(nbContents);

    // cells tagged 'shinylive' should be emmited as markdown
    fixupShinyliveCodeCells(nb);

    const assets = jupyterAssets(
      options.target.input,
      options.format.pandoc.to,
    );
    // NOTE: for perforance reasons the 'nb' is mutated in place
    // by jupyterToMarkdown (we don't want to make a copy of a
    // potentially very large notebook) so should not be relied
    // on subseuqent to this call
    const result = await jupyterToMarkdown(
      nb,
      {
        executeOptions: options,
        language: nb.metadata.kernelspec.language.toLowerCase(),
        assets,
        execute: options.format.execute,
        keepHidden: options.format.render[kKeepHidden],
        toHtml: isHtmlCompatible(options.format),
        toLatex: isLatexOutput(options.format.pandoc),
        toMarkdown: isMarkdownOutput(options.format),
        toIpynb: isIpynbOutput(options.format.pandoc),
        toPresentation: isPresentationOutput(options.format.pandoc),
        figFormat: options.format.execute[kFigFormat],
        figDpi: options.format.execute[kFigDpi],
        figPos: options.format.render[kFigPos],
        preserveCellMetadata:
          options.format.render[kNotebookPreserveCells] === true,
        preserveCodeCellYaml:
          options.format.render[kIpynbProduceSourceNotebook] === true,
      },
    );

    // return dependencies as either includes or raw dependencies
    let includes: PandocIncludes | undefined;
    let engineDependencies: Record<string, Array<unknown>> | undefined;
    if (options.dependencies) {
      includes = executeResultIncludes(options.tempDir, result.dependencies);
    } else {
      const dependencies = executeResultEngineDependencies(result.dependencies);
      if (dependencies) {
        engineDependencies = {
          [kJupyterEngine]: dependencies,
        };
      }
    }

    // if it's a transient notebook then remove it
    // (unless keep-ipynb was specified)
    cleanupNotebook(options.target, options.format);

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

  executeTargetSkipped: cleanupNotebook,

  dependencies: (options: DependenciesOptions) => {
    const includes: PandocIncludes = {};
    if (options.dependencies) {
      const includeFiles = includesForJupyterWidgetDependencies(
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

  run: async (options: RunOptions): Promise<void> => {
    let running = false;
    const [_dir, stem] = dirAndStem(options.input);
    const appFile = `${stem}-app.py`;
    const result = await execProcess(
      {
        cmd: [
          "shiny",
          "run",
          appFile,
          "--host",
          options.host!,
          "--port",
          String(options.port!),
        ],
        cwd: dirname(options.input),
      },
      undefined,
      undefined,
      (output) => {
        if (!running) {
          const kLocalPreviewRegex =
            /(http:\/\/(?:localhost|127\.0\.0\.1)\:\d+\/?[^\s]*)/;
          if (kLocalPreviewRegex.test(output)) {
            running = true;
            if (options.onReady) {
              options.onReady();
            }
          }
        }
        return output;
      },
    );
    if (!result.success) {
      throw new Error();
    }
  },

  postRender: async (files: RenderResultFile[], _context?: ProjectContext) => {
    // discover non _files dir resources for server: shiny and ammend app.py with them
    files.filter((file) => isServerShinyPython(file.format)).forEach((file) => {
      const [dir, stem] = dirAndStem(file.input);
      const filesDir = join(dir, inputFilesDir(file.input));
      const extraResources = file.resourceFiles
        .filter((resource) => !resource.startsWith(filesDir))
        .map((resource) => relative(dir, resource));
      const appScript = join(dir, `${stem}-app.py`);
      if (existsSync(appScript)) {
        // TODO: extraResoures is an array of relative paths to resources
        // that are NOT in the _files dir. these should be injected into
        // the appropriate place in appScript
      }
    });
  },

  postprocess: (options: PostProcessOptions) => {
    postProcessRestorePreservedHtml(options);
    return Promise.resolve();
  },

  canFreeze: true,

  generatesFigures: true,

  ignoreDirs: () => {
    return ["venv", "env"];
  },

  canKeepSource: (target: ExecutionTarget) => {
    return !isJupyterNotebook(target.source);
  },

  intermediateFiles: (input: string) => {
    const files: string[] = [];
    const [fileDir, fileStem] = dirAndStem(input);

    if (!isJupyterNotebook(input)) {
      files.push(join(fileDir, fileStem + ".ipynb"));
    } else if (
      [...kQmdExtensions, ...kJupyterPercentScriptExtensions].some((ext) => {
        return existsSync(join(fileDir, fileStem + ext));
      })
    ) {
      files.push(input);
    }
    return files;
  },
};

async function ensureYamlKernelspec(
  target: ExecutionTarget,
  kernelspec: JupyterKernelspec,
) {
  const markdown = target.markdown.value;
  const yamlJupyter = readYamlFromMarkdown(markdown)?.jupyter;
  if (yamlJupyter && typeof (yamlJupyter) !== "boolean") {
    const [yamlKernelspec, _] = await jupyterKernelspecFromMarkdown(markdown);
    if (yamlKernelspec.name !== kernelspec.name) {
      const nb = jupyterFromJSON(Deno.readTextFileSync(target.source));
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
  project?: ProjectContext,
) {
  const nb = await quartoMdToJupyter(target.markdown.value, true, project);
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
  const nb = await breakQuartoMd(target.markdown);
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

function cleanupNotebook(target: ExecutionTarget, format: Format) {
  // remove transient notebook if appropriate
  const data = target.data as JupyterTargetData;
  if (data.transient) {
    if (!format.execute[kKeepIpynb]) {
      removeIfExists(target.input);
    }
  }
}

interface JupyterTargetData {
  transient: boolean;
  kernelspec: JupyterKernelspec;
}

function executeResultIncludes(
  tempDir: string,
  widgetDependencies?: JupyterWidgetDependencies,
): PandocIncludes | undefined {
  if (widgetDependencies) {
    const includes: PandocIncludes = {};
    const includeFiles = includesForJupyterWidgetDependencies(
      [widgetDependencies],
      tempDir,
    );
    if (includeFiles.inHeader) {
      includes[kIncludeInHeader] = [includeFiles.inHeader];
    }
    if (includeFiles.afterBody) {
      includes[kIncludeAfterBody] = [includeFiles.afterBody];
    }
    return includes;
  } else {
    return undefined;
  }
}

function executeResultEngineDependencies(
  widgetDependencies?: JupyterWidgetDependencies,
): Array<unknown> | undefined {
  if (widgetDependencies) {
    return [widgetDependencies];
  } else {
    return undefined;
  }
}
