/*
 * jupyter.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { basename, dirname, join, relative } from "../../deno_ral/path.ts";
import { satisfies } from "semver/mod.ts";

import { existsSync } from "fs/mod.ts";

import { error } from "../../deno_ral/log.ts";

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
  isHtmlCompatible,
  isHtmlDashboardOutput,
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
import {
  inputFilesDir,
  isServerShiny,
  isServerShinyPython,
} from "../../core/render.ts";
import { jupyterCapabilities } from "../../core/jupyter/capabilities.ts";
import { runExternalPreviewServer } from "../../preview/preview-server.ts";
import { onCleanup } from "../../core/cleanup.ts";
import { projectOutputDir } from "../../project/project-shared.ts";
import { assert } from "testing/asserts.ts";

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

  markdownForFile(file: string): Promise<MappedString> {
    if (isJupyterNotebook(file)) {
      const nbJSON = Deno.readTextFileSync(file);
      const nb = JSON.parse(nbJSON) as JupyterNotebook;
      return Promise.resolve(asMappedString(markdownFromNotebookJSON(nb)));
    } else if (isJupyterPercentScript(file)) {
      return Promise.resolve(
        asMappedString(markdownFromJupyterPercentScript(file)),
      );
    } else {
      return Promise.resolve(mappedStringFromFile(file));
    }
  },

  target: async (
    file: string,
    _quiet?: boolean,
    markdown?: MappedString,
    project?: ProjectContext,
  ): Promise<ExecutionTarget | undefined> => {
    assert(markdown);
    // at some point we'll resolve a full notebook/kernelspec
    let nb: JupyterNotebook | undefined;
    if (isJupyterNotebook(file)) {
      const nbJSON = Deno.readTextFileSync(file);
      nb = JSON.parse(nbJSON) as JupyterNotebook;
    }

    // cache check for percent script
    const isPercentScript = isJupyterPercentScript(file);

    // get the metadata
    const metadata = readYamlFromMarkdown(markdown.value);

    // if this is a text markdown file then create a notebook for use as the execution target
    if (isQmdFile(file) || isPercentScript) {
      // write a transient notebook
      const [fileDir, fileStem] = dirAndStem(file);
      // See #4802
      // I don't love using an extension other than .ipynb for this file,
      // but doing something like .quarto.ipynb would require a lot
      // of additional changes to our file handling code (without changes,
      // our output files would be called $FILE.quarto.html, which
      // is not what we want). So for now, we'll use .quarto_ipynb
      const notebook = join(fileDir, fileStem + ".quarto_ipynb");
      const target = {
        source: file,
        input: notebook,
        markdown: markdown!,
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
        markdown: markdown!,
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

    // Preserve the cell metadata if users have asked us to, or if this is dashboard
    // that is coming from a non-qmd source
    const preserveCellMetadata =
      options.format.render[kNotebookPreserveCells] === true ||
      (isHtmlDashboardOutput(options.format.identifier[kBaseFormat]) &&
        !isQmdFile(options.target.source));

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
        preserveCellMetadata,
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
    const caps = await jupyterCapabilities();
    if (!caps?.shiny) {
      shinyError =
        "The shiny package is required for documents with server: shiny";
    } else if (!satisfies(asSemVer(caps.shiny), asSemVer(kShinyVersion))) {
      shinyError =
        `The shiny package version must be ${kShinyVersion} for documents with server: shiny`;
    }
    if (shinyError) {
      shinyError +=
        "\n\nInstall the latest version of shiny with pip install --upgrade shiny\n";
      error(shinyError);
      throw new Error();
    }

    const [_dir] = dirAndStem(options.input);
    const appFile = "app.py";
    const cmd = [
      ...await pythonExec(),
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
      cmd.push(`--reload-includes`);
      cmd.push(`*.py`);
    }

    // start server
    const readyPattern = /(http:\/\/(?:localhost|127\.0\.0\.1)\:\d+\/?[^\s]*)/;
    const server = runExternalPreviewServer({
      cmd,
      readyPattern,
      cwd: dirname(options.input),
    });
    await server.start();

    // stop the server onCleanup
    onCleanup(async () => {
      await server.stop();
    });

    // notify when ready
    if (options.onReady) {
      options.onReady();
    }

    // run the server
    return server.serve();
  },

  postRender: async (file: RenderResultFile, _context?: ProjectContext) => {
    // discover non _files dir resources for server: shiny and amend app.py with them
    if (isServerShiny(file.format)) {
      const [dir] = dirAndStem(file.input);
      const filesDir = join(dir, inputFilesDir(file.input));
      const extraResources = file.resourceFiles
        .filter((resource) => !resource.startsWith(filesDir))
        .map((resource) => relative(dir, resource));
      const appScriptDir = _context ? projectOutputDir(_context) : dir;
      const appScript = join(appScriptDir, `app.py`);
      if (existsSync(appScript)) {
        // compute static assets
        const staticAssets = [inputFilesDir(file.input), ...extraResources];

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
  if (yamlJupyter && typeof yamlJupyter !== "boolean") {
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
