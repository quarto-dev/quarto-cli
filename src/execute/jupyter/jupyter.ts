/*
* jupyter.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { extname, join } from "path/mod.ts";
import { info } from "log/mod.ts";

import { execProcess } from "../../core/process.ts";
import {
  readYamlFromMarkdown,
  readYamlFromMarkdownFile,
  readYamlFrontMatterFromMarkdownFile,
} from "../../core/yaml.ts";
import { partitionMarkdown } from "../../core/pandoc/pandoc-partition.ts";

import { dirAndStem } from "../../core/path.ts";

import { Metadata } from "../../config/metadata.ts";

import type {
  DependenciesOptions,
  ExecuteOptions,
  ExecuteResult,
  ExecutionEngine,
  ExecutionTarget,
  PandocIncludes,
  PostProcessOptions,
} from "../engine.ts";
import {
  jupyterAssets,
  jupyterFromFile,
  jupyterMdToJupyter,
  jupyterToMarkdown,
} from "../../core/jupyter/jupyter.ts";
import {
  kExecute,
  kFigDpi,
  kFigFormat,
  kIncludeAfterBody,
  kIncludeInHeader,
  kKeepIpynb,
  kKernelKeepalive,
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
import {
  isJupyterKernelspec,
  JupyterKernelspec,
  jupyterKernelspec,
} from "../../core/jupyter/kernels.ts";
import { lines } from "../../core/text.ts";

const kNotebookExtensions = [
  ".ipynb",
];
const kJupytextMdExtensions = [
  ".md",
  ".markdown",
];

export const jupyterEngine: ExecutionEngine = {
  name: "jupyter",

  defaultExt: ".md",

  defaultYaml: (kernel?: string) => [
    `jupyter: ${kernel || "python3"}`,
  ],

  canHandle: (file: string) => {
    const ext = extname(file);
    if (kJupytextMdExtensions.includes(ext)) {
      const yaml = readYamlFrontMatterFromMarkdownFile(file);
      return !!yaml?.jupyter;
    } else {
      return isNotebook(file);
    }
  },

  target: async (
    file: string,
    quiet?: boolean,
  ): Promise<ExecutionTarget | undefined> => {
    const notebookTarget = async () => {
      // if it's an .Rmd or .md file, then read the YAML to see if has jupytext,
      // if it does, check for a paired notebook and return it
      const ext = extname(file);
      if (kJupytextMdExtensions.includes(ext)) {
        const yaml = readYamlFromMarkdownFile(file);
        if (yaml.jupyter) {
          if (typeof (yaml.jupyter) === "string") {
            return { sync: true, paired: [file] };
          } else if ((yaml.jupyter as Record<string, unknown>).jupytext) {
            const paired = await pairedPaths(file);
            return { sync: true, paired: [file, ...paired] };
          } else if (
            typeof ((yaml.jupyter as Record<string, unknown>).kernel) ===
              "string" ||
            isJupyterKernelspec(
              (yaml.jupyter as Record<string, unknown>).kernelspec,
            )
          ) {
            return { sync: true, paired: [file] };
          }
        }
      } else if (isNotebook(file)) {
        const nb = jupyterFromFile(file);
        const isJupytext = !!nb.metadata.jupytext;
        return {
          sync: isJupytext,
          paired: isJupytext ? [file, ...await pairedPaths(file)] : [file],
        };
      }
    };

    // see if there is a notebook target, if there is then sync it if required and return
    const target = await notebookTarget();
    if (target) {
      let notebook = pairedPath(target.paired, isNotebook);

      // track whether the notebook is transient or a permanent artifact
      const transient = !notebook;

      // sync if there are paired represenations in play (wouldn't sync if e.g.
      // this was just a plain .ipynb file w/ no jupytext peers)
      if (target.sync) {
        // progress
        if (!quiet && !transient) {
          const pairedExts = target.paired.map((p) => extname(p).slice(1));
          info(
            "[jupytext] " + "Syncing " + pairedExts.join(",") + "...",
            { newline: false },
          );
        }

        // perform the sync if there are other targets
        if (target.paired.length > 1) {
          await jupytextSync(file, target.paired, true);
        }

        // if this is a markdown file with no paired notebook then create a transient one
        const ext = extname(file);
        if (kJupytextMdExtensions.includes(ext) && !notebook) {
          // get the kernelspec and jupyter metadata
          const [kernelspec, metadata] = await jupyterKernelspecFromFile(file);

          // write the notebook
          const [fileDir, fileStem] = dirAndStem(file);
          const nb = jupyterMdToJupyter(file, kernelspec, metadata);
          notebook = join(fileDir, fileStem + ".ipynb");
          Deno.writeTextFileSync(notebook, JSON.stringify(nb, null, 2));
        }

        if (!quiet && !transient) {
          info("Done");
        }
      }

      if (notebook) {
        const data: JupyterTargetData = {
          transient,
          jupytext: target.sync && target.paired.length > 1,
        };
        return { source: file, input: notebook, data };
      } else {
        return undefined;
      }
    }
  },

  metadata: async (file: string): Promise<Metadata> => {
    // read metadata
    if (isNotebook(file)) {
      return readYamlFromMarkdown(await markdownFromNotebook(file));
    } else {
      return readYamlFromMarkdown(Deno.readTextFileSync(file));
    }
  },

  partitionedMarkdown: async (file: string) => {
    if (isNotebook(file)) {
      return partitionMarkdown(await markdownFromNotebook(file));
    } else {
      return partitionMarkdown(Deno.readTextFileSync(file));
    }
  },

  execute: async (options: ExecuteOptions): Promise<ExecuteResult> => {
    // determine default execution behavior if none is specified
    let execute = options.format.execution[kExecute];
    if (execute === null) {
      execute = !isNotebook(options.target.source);
    }
    // execute if we need to
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

      if (options.format.execution[kKernelKeepalive] === 0) {
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
    const result = jupyterToMarkdown(
      nb,
      {
        language: nb.metadata.kernelspec.language,
        assets,
        execution: options.format.execution,
        toHtml: isHtmlCompatible(options.format),
        toLatex: isLatexOutput(options.format.pandoc),
        toMarkdown: isMarkdownOutput(options.format.pandoc),
        figFormat: options.format.execution[kFigFormat],
        figDpi: options.format.execution[kFigDpi],
      },
    );

    // convert dependencies to include files
    const includes: PandocIncludes = {};
    let dependencies: JupyterWidgetDependencies | undefined;
    if (options.dependencies) {
      if (result.dependencies) {
        const includeFiles = includesForJupyterWidgetDependencies(
          [result.dependencies],
        );
        if (includeFiles.inHeader) {
          includes[kIncludeInHeader] = includeFiles.inHeader;
        }
        if (includeFiles.afterBody) {
          includes[kIncludeAfterBody] = includeFiles.afterBody;
        }
      }
    } else {
      dependencies = result.dependencies;
    }

    // if it's a transient notebook then remove it, otherwise
    // sync so that jupyter[lab] can open the .ipynb w/o errors
    const data = options.target.data as JupyterTargetData;
    if (data.transient) {
      if (!options.format.render[kKeepIpynb]) {
        Deno.removeSync(options.target.input);
      }
    } else if (data.jupytext) {
      await jupytextSync(options.target.input, [], true);
    }

    // return results
    return {
      markdown: result.markdown,
      supporting: [assets.supporting_dir],
      filters: [],
      includes,
      dependencies,
      preserve: result.htmlPreserve,
    };
  },

  executeTargetSkipped: (target: ExecutionTarget, format: Format) => {
    // remove transient notebook if appropriate
    const data = target.data as JupyterTargetData;
    if (data.transient) {
      if (!format.render[kKeepIpynb]) {
        Deno.removeSync(target.input);
      }
    }
  },

  dependencies: (options: DependenciesOptions) => {
    const includes: PandocIncludes = {};
    if (options.dependencies) {
      const includeFiles = includesForJupyterWidgetDependencies(
        [options.dependencies as JupyterWidgetDependencies],
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

  keepMd,

  keepFiles: (input: string) => {
    const files: string[] = [];
    const keep = keepMd(input);
    if (keep) {
      files.push(keep);
    }
    if (!isNotebook(input) && !input.endsWith(kKeepSuffix)) {
      const [fileDir, fileStem] = dirAndStem(input);
      files.push(join(fileDir, fileStem + ".ipynb"));
    }
    return files;
  },
};

export function pythonBinary(binary = "python3") {
  return binary;
}

const kKeepSuffix = ".ipynb.md";

function keepMd(input: string) {
  if (!input.endsWith(kKeepSuffix)) {
    const [dir, stem] = dirAndStem(input);
    return join(dir, stem + ".ipynb.md");
  }
}

interface JupyterTargetData {
  transient: boolean;
  jupytext: boolean;
}

async function jupyterKernelspecFromFile(
  file: string,
): Promise<[JupyterKernelspec, Metadata]> {
  const yaml = readYamlFromMarkdownFile(file);
  if (yaml.jupyter) {
    if (typeof (yaml.jupyter) === "string") {
      const kernel = yaml.jupyter;
      const kernelspec = await jupyterKernelspec(kernel);
      if (kernelspec) {
        return [kernelspec, {}];
      } else {
        return Promise.reject(
          new Error("Jupyter kernel '" + kernel + "' not found."),
        );
      }
    } else if (typeof (yaml.jupyter) === "object") {
      const jupyter = { ...yaml.jupyter } as Record<string, unknown>;
      if (isJupyterKernelspec(jupyter.kernelspec)) {
        const kernelspec = jupyter.kernelspec;
        delete jupyter.kernelspec;
        return [kernelspec, jupyter];
      } else if (typeof (jupyter.kernel) === "string") {
        const kernelspec = await jupyterKernelspec(jupyter.kernel);
        if (kernelspec) {
          delete jupyter.kernel;
          return [kernelspec, jupyter];
        } else {
          return Promise.reject(
            new Error("Jupyter kernel '" + jupyter.kernel + "' not found."),
          );
        }
      } else {
        return Promise.reject(
          new Error(
            "Invalid Jupyter kernelspec (must include name, language, & display_name)",
          ),
        );
      }
    } else {
      return Promise.reject(
        new Error(
          "Invalid jupyter YAML metadata found in file (must be string or object)",
        ),
      );
    }
  } else {
    return Promise.reject(
      new Error("No jupyter YAML metadata found in file"),
    );
  }
}

function filteredMetadata(paired: string[]) {
  // if there is a markdown file in the paried representations that doesn't have
  // the jupytext text_representation & notebook_metadata_filter fields then
  // we've opted in to a lighter metadata treatment
  const markdown = pairedPath(paired, isMarkdown);
  if (markdown) {
    const yaml = readYamlFromMarkdownFile(markdown) as Record<
      string,
      // deno-lint-ignore no-explicit-any
      any
    >;
    const filter: string[] = [];

    if (!yaml.jupyter?.jupytext?.text_representation.format_version) {
      filter.push("jupytext.text_representation.format_version");
    }
    if (!yaml.jupyter?.jupytext?.text_representation.jupytext_version) {
      filter.push("jupytext.text_representation.jupytext_version");
    }
    if (!yaml.jupyter?.jupytext?.notebook_metadata_filter) {
      filter.push("jupytext.notebook_metadata_filter");
    }
    if (!yaml.jupyter?.jupytext?.main_language) {
      filter.push("jupytext.main_language");
    }

    return filter;
  }
  return [];
}

async function pairedPaths(file: string) {
  const result = await execProcess({
    cmd: [
      pythonBinary("jupytext"),
      "--paired-paths",
      "--quiet",
      file,
    ],
    stdout: "piped",
  });
  if (result.stdout) {
    return lines(result.stdout).filter((line) => line.length > 0);
  } else {
    return [];
  }
}

function pairedPath(paired: string[], selector: (file: string) => boolean) {
  if (paired) {
    return paired.find(selector);
  } else {
    return undefined;
  }
}

function isNotebook(file: string) {
  return kNotebookExtensions.includes(extname(file).toLowerCase());
}

function isMarkdown(file: string) {
  return kJupytextMdExtensions.includes(extname(file).toLowerCase());
}

function isHtmlCompatible(format: Format) {
  return isHtmlOutput(format.pandoc) ||
    (isMarkdownOutput(format.pandoc) && format.render[kPreferHtml]);
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

async function jupytextSync(
  file: string,
  paired: string[],
  quiet?: boolean,
) {
  const args = [
    "--sync",
    file,
  ];
  if (paired.length > 0) {
    const filtered = filteredMetadata(paired);
    args.push(
      "--opt",
      "notebook_metadata_filter=" +
        filtered.map((m) => `-${m}`).join(","),
    );
    // if we are filtering the kernelspec then make sure we
    // set the kernel when syncing the notebook
    if (filtered.includes("kernelspec")) {
      args.push(
        "--set-kernel",
        "-",
      );
    }
  }
  if (quiet) {
    args.push("--quiet");
  }
  await jupytext(...args);
}
/*
async function jupytextTo(
  file: string,
  format: string,
  kernel?: string,
  output?: string,
  quiet?: boolean,
) {
  const args = [file, "--from", "md:markdown", "--to", format];
  if (kernel) {
    args.push("--set-kernel");
    args.push("-");
  }
  if (output) {
    args.push("--output");
    args.push(output);
  }
  if (quiet) {
    args.push("--quiet");
  }
  await jupytext(...args);
}

async function jupytextSetFormats(
  file: string,
  formats: string[],
  quiet?: boolean,
) {
  // create ipynb
  const args = ["--set-formats", formats.join(","), file];
  if (quiet) {
    args.push("--quiet");
  }
  await jupytext(...args);
}

async function jupytextUpdateMetadata(
  file: string,
  metadata: Record<string, unknown>,
  quiet?: boolean,
) {
  const args = [
    "--update-metadata",
    JSON.stringify(metadata),
    file,
  ];
  if (quiet) {
    args.push("--quiet");
  }
  await jupytext(...args);
}
*/

async function jupytext(...args: string[]) {
  try {
    const result = await execProcess(
      {
        cmd: [
          pythonBinary("jupytext"),
          ...args,
        ],
        stderr: "piped",
      },
      undefined,
      "stdout>stderr",
    );
    if (!result.success) {
      throw new Error(result.stderr || "Error syncing jupytext");
    }
  } catch {
    throw new Error(
      "Unable to execute jupytext. Have you installed the jupytext package?",
    );
  }
}
