/*
* jupyter.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { extname, join } from "path/mod.ts";

import { readYamlFromMarkdown } from "../../core/yaml.ts";
import { partitionMarkdown } from "../../core/pandoc/pandoc-partition.ts";

import { dirAndStem } from "../../core/path.ts";

import { Metadata } from "../../config/metadata.ts";

import {
  DependenciesOptions,
  ExecuteOptions,
  ExecuteResult,
  ExecutionEngine,
  ExecutionTarget,
  kQmdExtensions,
  PandocIncludes,
  PostProcessOptions,
} from "../engine.ts";
import {
  isJupyterNotebook,
  jupyterAssets,
  jupyterFromFile,
  jupyterKernelspecFromFile,
  jupyterToMarkdown,
  kJupyterNotebookExtensions,
  quartoMdToJupyter,
} from "../../core/jupyter/jupyter.ts";
import {
  kExecuteDaemon,
  kExecuteEnabled,
  kFigDpi,
  kFigFormat,
  kIncludeAfterBody,
  kIncludeInHeader,
  kKeepHidden,
  kKeepIpynb,
  kPreferHtml,
} from "../../config/constants.ts";
import {
  Format,
  isHtmlOutput,
  isLatexOutput,
  isMarkdownOutput,
} from "../../config/format.ts";
import { restorePreservedHtml } from "../../core/jupyter/preserve.ts";

import {
  executeKernelKeepalive,
  executeKernelOneshot,
} from "./jupyter-kernel.ts";
import {
  includesForJupyterWidgetDependencies,
  JupyterWidgetDependencies,
} from "../../core/jupyter/widgets.ts";

const kJupyterEngine = "jupyter";

export const jupyterEngine: ExecutionEngine = {
  name: kJupyterEngine,

  defaultExt: ".md",

  defaultYaml: (kernel?: string) => [
    `jupyter: ${kernel || "python3"}`,
  ],

  validExtensions: () => kJupyterNotebookExtensions.concat(kQmdExtensions),

  claimsExtension: (ext: string) => {
    return kJupyterNotebookExtensions.includes(ext.toLowerCase());
  },

  claimsLanguage: (_language: string) => {
    return false;
  },

  target: async (
    file: string,
  ): Promise<ExecutionTarget | undefined> => {
    // if this is a text markdown file then create a notebook for use as the execution target
    const ext = extname(file);
    if (kQmdExtensions.includes(ext)) {
      // write a transient notebook
      const [kernelspec, metadata] = await jupyterKernelspecFromFile(file);
      const [fileDir, fileStem] = dirAndStem(file);
      const nb = quartoMdToJupyter(file, kernelspec, metadata);
      const notebook = join(fileDir, fileStem + ".ipynb");
      Deno.writeTextFileSync(notebook, JSON.stringify(nb, null, 2));
      return { source: file, input: notebook, data: { transient: true } };
    } else if (isJupyterNotebook(file)) {
      return { source: file, input: file, data: { transient: false } };
    } else {
      return undefined;
    }
  },

  metadata: async (file: string): Promise<Metadata> => {
    // read metadata
    if (isJupyterNotebook(file)) {
      return readYamlFromMarkdown(await markdownFromNotebook(file));
    } else {
      return readYamlFromMarkdown(Deno.readTextFileSync(file));
    }
  },

  partitionedMarkdown: async (file: string) => {
    if (isJupyterNotebook(file)) {
      return partitionMarkdown(await markdownFromNotebook(file));
    } else {
      return partitionMarkdown(Deno.readTextFileSync(file));
    }
  },

  execute: async (options: ExecuteOptions): Promise<ExecuteResult> => {
    // determine execution behavior
    const execute = options.format.execute[kExecuteEnabled] !== false;
    if (execute) {
      // jupyter back end requires full path to input (to ensure that
      // keepalive kernels are never re-used across multiple inputs
      // that happen to share a hash)
      const execOptions = {
        ...options,
        target: {
          ...options.target,
          input: Deno.realPathSync(options.target.input),
        },
      };

      if (
        options.format.execute[kExecuteDaemon] === false ||
        options.format.execute[kExecuteDaemon] === 0
      ) {
        await executeKernelOneshot(execOptions);
      } else {
        await executeKernelKeepalive(execOptions);
      }
    }

    // convert to markdown and write to target
    const nb = jupyterFromFile(options.target.input);
    const assets = jupyterAssets(
      options.target.input,
      options.format.pandoc.to,
    );
    // NOTE: for perforance reasons the 'nb' is mutated in place
    // by jupyterToMarkdown (we don't want to make a copy of a
    // potentially very large notebook) so should not be relied
    // on subseuqent to this call
    const result = jupyterToMarkdown(
      nb,
      {
        language: nb.metadata.kernelspec.language,
        assets,
        execute: options.format.execute,
        keepHidden: options.format.render[kKeepHidden],
        toHtml: isHtmlCompatible(options.format),
        toLatex: isLatexOutput(options.format.pandoc),
        toMarkdown: isMarkdownOutput(options.format.pandoc),
        figFormat: options.format.execute[kFigFormat],
        figDpi: options.format.execute[kFigDpi],
      },
    );

    // return dependencies as either includes or raw dependencies
    const dependencies = executeResultDependencies(
      options.dependencies ? "includes" : "dependencies",
      result.dependencies,
    );

    // if it's a transient notebook then remove it
    // (unless keep-ipynb was specified)
    cleanupNotebook(options.target, options.format);

    // return results
    return {
      markdown: result.markdown,
      supporting: [assets.supporting_dir],
      filters: [],
      dependencies,
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
      );
      if (includeFiles.inHeader) {
        includes[kIncludeInHeader] = includeFiles.inHeader;
      }
      if (includeFiles.afterBody) {
        includes[kIncludeAfterBody] = includeFiles.afterBody;
      }
    }
    return Promise.resolve({
      includes,
    });
  },

  postprocess: (options: PostProcessOptions) => {
    // read the output file
    let output = Deno.readTextFileSync(options.output);

    // substitute
    output = restorePreservedHtml(
      output,
      options.preserve,
    );

    // re-write the output
    Deno.writeTextFileSync(options.output, output);

    return Promise.resolve();
  },

  canKeepMd: true,

  keepFiles: (input: string) => {
    if (!isJupyterNotebook(input) && !input.endsWith(`.${kJupyterEngine}.md`)) {
      const [fileDir, fileStem] = dirAndStem(input);
      return [join(fileDir, fileStem + ".ipynb")];
    }
  },
};

export function pythonBinary(binary = "python3") {
  return binary;
}

function cleanupNotebook(target: ExecutionTarget, format: Format) {
  // remove transient notebook if appropriate
  const data = target.data as JupyterTargetData;
  if (data.transient) {
    if (!format.render[kKeepIpynb]) {
      Deno.removeSync(target.input);
    }
  }
}

interface JupyterTargetData {
  transient: boolean;
}

function isHtmlCompatible(format: Format) {
  return isHtmlOutput(format.pandoc) ||
    (isMarkdownOutput(format.pandoc) && format.render[kPreferHtml]);
}

function executeResultDependencies(
  type: "includes" | "dependencies",
  dependencies?: JupyterWidgetDependencies,
) {
  // convert dependencies to include files
  const dependenciesAsIncludes = () => {
    const includes: PandocIncludes = {};
    if (dependencies) {
      const includeFiles = includesForJupyterWidgetDependencies(
        [dependencies],
      );
      if (includeFiles.inHeader) {
        includes[kIncludeInHeader] = includeFiles.inHeader;
      }
      if (includeFiles.afterBody) {
        includes[kIncludeAfterBody] = includeFiles.afterBody;
      }
    }
    return includes;
  };

  return {
    type,
    data: type === "includes"
      ? dependenciesAsIncludes()
      : dependencies
      ? [dependencies]
      : [],
  };
}

async function markdownFromNotebook(file: string) {
  const decoder = new TextDecoder("utf-8");
  const nbContents = await Deno.readFile(file);
  const nb = JSON.parse(decoder.decode(nbContents));
  const cells = nb.cells as Array<{ cell_type: string; source: string[] }>;
  const markdown = cells.reduce((md, cell) => {
    if (["markdown", "raw"].includes(cell.cell_type)) {
      return md + "\n" + cell.source.join("");
    } else {
      return md;
    }
  }, "");
  return markdown;
}
