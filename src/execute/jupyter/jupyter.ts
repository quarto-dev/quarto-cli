/*
* jupyter.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { basename, dirname, extname, join } from "path/mod.ts";
import { existsSync } from "fs/mod.ts";
import { walkSync } from "fs/walk.ts";

import { getenv } from "../../core/env.ts";
import { execProcess } from "../../core/process.ts";
import {
  readYamlFromMarkdown,
  readYamlFromMarkdownFile,
} from "../../core/yaml.ts";

import { dirAndStem } from "../../core/path.ts";
import { message } from "../../core/console.ts";

import { Metadata } from "../../config/metadata.ts";

import type {
  DependenciesOptions,
  ExecuteOptions,
  ExecuteResult,
  ExecutionEngine,
  ExecutionTarget,
  PostProcessOptions,
} from "../engine.ts";
import {
  isJupyterKernelspec,
  jupyterAssets,
  jupyterFromFile,
  JupyterKernelspec,
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
  FormatPandoc,
  isHtmlFormat,
  isLatexFormat,
  isMarkdownFormat,
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

const kNotebookExtensions = [
  ".ipynb",
];
const kJupytextMdExtensions = [
  ".md",
  ".markdown",
];
const kCodeExtensions = [
  ".py",
  ".clj",
  ".jl",
  ".js",
  ".ts",
  ".cs",
  ".java",
  ".groovy",
];

export const jupyterEngine: ExecutionEngine = {
  name: "jupyter",

  handle: async (file: string, quiet: boolean) => {
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
      } // if it's a code file, then check for a paired notebook and return it
      else if (kCodeExtensions.includes(ext)) {
        const paired = await pairedPaths(file);
        return { sync: true, paired: [file, ...paired] };
        // if it's a notebook file then return it
      } else if (isNotebook(file)) {
        return { sync: false, paired: [file] };
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
          message(
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
          message("Done");
        }
      }

      if (notebook) {
        return { input: notebook, data: transient };
      } else {
        return undefined;
      }
    }
  },

  metadata: async (target: ExecutionTarget): Promise<Metadata> => {
    // read metadata
    const decoder = new TextDecoder("utf-8");
    const nbContents = await Deno.readFile(target.input);
    const nb = JSON.parse(decoder.decode(nbContents));
    const cells = nb.cells as Array<{ cell_type: string; source: string[] }>;
    const markdown = cells.reduce((md, cell) => {
      if (["markdown", "raw"].includes(cell.cell_type)) {
        return md + "\n" + cell.source.join("");
      } else {
        return md;
      }
    }, "");

    return readYamlFromMarkdown(markdown);
  },

  execute: async (options: ExecuteOptions): Promise<ExecuteResult> => {
    // execute if we need to
    if (options.format.execution[kExecute] === true) {
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
        toLatex: isLatexFormat(options.format.pandoc),
        toMarkdown: isMarkdownFormat(options.format.pandoc),
        figFormat: options.format.execution[kFigFormat],
        figDpi: options.format.execution[kFigDpi],
      },
    );

    // convert dependencies to include files
    const pandoc: FormatPandoc = {};
    let dependencies: JupyterWidgetDependencies | undefined;
    if (options.dependencies) {
      if (result.dependencies) {
        const includeFiles = includesForJupyterWidgetDependencies(
          [result.dependencies],
        );
        pandoc[kIncludeInHeader] = includeFiles.inHeader;
        pandoc[kIncludeAfterBody] = includeFiles.afterBody;
      }
    } else {
      dependencies = result.dependencies;
    }

    // if it's a transient notebook then remove it, otherwise
    // sync so that jupyter[lab] can open the .ipynb w/o errors
    if (options.target.data && !options.format.render[kKeepIpynb]) {
      Deno.removeSync(options.target.input);
    } else {
      await jupytextSync(options.target.input, [], true);
    }

    // return results
    return {
      markdown: result.markdown,
      supporting: [assets.supporting_dir],
      filters: [],
      pandoc,
      dependencies,
      preserve: result.htmlPreserve,
    };
  },

  dependencies: async (options: DependenciesOptions) => {
    const pandoc: FormatPandoc = {};
    if (options.dependencies) {
      const includeFiles = includesForJupyterWidgetDependencies(
        [options.dependencies as JupyterWidgetDependencies],
      );
      pandoc[kIncludeInHeader] = includeFiles.inHeader;
      pandoc[kIncludeAfterBody] = includeFiles.afterBody;
    }
    return {
      pandoc,
    };
  },

  postprocess: async (options: PostProcessOptions) => {
    // read the output file
    let output = Deno.readTextFileSync(options.output);

    // substitute
    output = restorePreservedHtml(
      output,
      options.preserve,
    );

    // re-write the output
    Deno.writeTextFileSync(options.output, output);
  },

  keepMd: (input: string) => {
    return join(dirname(input), basename(input) + ".md");
  },
};

export function pythonBinary(binary = "python") {
  const condaPrefix = getenv("CONDA_PREFIX");
  return condaPrefix +
    (Deno.build.os !== "windows" ? "/bin/" : "\\") +
    binary;
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
    return result.stdout.split(/\r?\n/).filter((line) => line.length > 0);
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
  return isHtmlFormat(format.pandoc) ||
    (isMarkdownFormat(format.pandoc) && format.render[kPreferHtml]);
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
      (data: Uint8Array) => {
        Deno.stderr.writeSync(data);
      },
    );
    if (!result.success) {
      throw new Error(result.stderr || "Error syncing jupytext");
    }
  } catch (e) {
    throw new Error(
      "Unable to execute jupytext. Have you installed the jupytext package?",
    );
  }
}

async function jupyterKernelspec(
  name: string,
): Promise<JupyterKernelspec | undefined> {
  const kernelspecs = await jupyterKernelspecs();
  return kernelspecs.get(name);
}

async function jupyterKernelspecs(): Promise<Map<string, JupyterKernelspec>> {
  const result = await execProcess(
    {
      cmd: [pythonBinary("jupyter"), "--paths", "--json"],
      stdout: "piped",
    },
  );
  if (result.success) {
    const kernelmap = new Map<string, JupyterKernelspec>();
    const dataPaths = JSON.parse(result.stdout!).data;
    for (const path of dataPaths) {
      if (!existsSync(path)) {
        continue;
      }
      const kernels = join(path, "kernels");
      if (!existsSync(kernels)) {
        continue;
      }
      for (const walk of walkSync(kernels, { maxDepth: 1 })) {
        if (walk.path === kernels || !walk.isDirectory) {
          continue;
        }
        const kernelConfig = join(walk.path, "kernel.json");
        if (existsSync(kernelConfig)) {
          const config = JSON.parse(Deno.readTextFileSync(kernelConfig));
          const name = basename(walk.path);
          kernelmap.set(name, {
            name,
            language: config.language,
            display_name: config.display_name,
          });
        }
      }
    }
    return kernelmap;
  } else {
    return Promise.reject();
  }
}
