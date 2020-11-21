/*
* jupyter.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
* Unless you have received this program directly from RStudio pursuant
* to the terms of a commercial license agreement with RStudio, then
* this program is licensed to you under the terms of version 3 of the
* GNU General Public License. This program is distributed WITHOUT
* ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
* MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
* GPL (http://www.gnu.org/licenses/gpl-3.0.txt) for more details.
*
*/

import { basename, dirname, extname, join } from "path/mod.ts";
import { getenv } from "../core/env.ts";
import { execProcess, ProcessResult } from "../core/process.ts";
import { resourcePath } from "../core/resources.ts";
import {
  readYamlFromMarkdown,
  readYamlFromMarkdownFile,
} from "../core/yaml.ts";

import { dirAndStem } from "../core/path.ts";
import { message } from "../core/console.ts";

import { Metadata } from "../config/metadata.ts";

import type {
  ExecuteOptions,
  ExecuteResult,
  ExecutionEngine,
  ExecutionTarget,
  PostProcessOptions,
} from "./engine.ts";
import {
  jupyterAssets,
  jupyterFromFile,
  jupyterToMarkdown,
} from "../core/jupyter/jupyter.ts";
import {
  kExecute,
  kFigDpi,
  kFigFormat,
  kIncludeAfterBody,
  kIncludeInHeader,
  kPreferHtml,
} from "../config/constants.ts";
import {
  isHtmlFormat,
  isLatexFormat,
  isMarkdownFormat,
} from "../config/format.ts";
import { restorePreservedHtml } from "../core/jupyter/preserve.ts";

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
        if (isJupytextMd(file)) {
          const paired = await pairedPaths(file);
          return { sync: true, paired: [file, ...paired] };
        }
      } // if it's a code file, then check for a paired notebook and return it
      else if (kCodeExtensions.includes(ext)) {
        const paired = await pairedPaths(file);
        return { sync: true, paired: [file, ...paired] };
        // if it's a notebook file then return it
      } else if (isNotebook(file)) {
        const paired = await pairedPaths(file);
        return { sync: paired.length > 0, paired: [file, ...paired] };
      }
    };

    // see if there is a notebook target, if there is then sync it if required and return
    const target = await notebookTarget();
    if (target) {
      let notebook = pairedPath(target.paired, isNotebook);
      // track whether the notebook is transient or a permanent artifact
      let transient = false;
      // sync if there are paired represenations in play (wouldn't sync if e.g.
      // this was just a plain .ipynb file w/ no jupytext peers)
      if (target.sync) {
        // progress
        if (!quiet) {
          const pairedExts = target.paired.map((p) => extname(p).slice(1));
          if (!notebook) {
            pairedExts.push("ipynb");
          }
          message(
            "[jupytext] " + "Syncing " + pairedExts.join(",") + "...",
            { newline: false },
          );
        }

        // perform the sync if there are other targets
        if (target.paired.length > 1) {
          await jupytextSync(file, target.paired, true);
        }

        // if there is no paired notebook then create a transient one
        if (!notebook) {
          transient = true;
          // if there is no kernelspec in the source, then set to the
          // curret default python kernel
          const filtered = filteredMetadata(target.paired);
          const setKernel = filtered.includes("kernelspec");
          const [fileDir, fileStem] = dirAndStem(file);
          notebook = join(fileDir, fileStem + ".ipynb");
          await jupytextTo(
            file,
            "ipynb",
            setKernel ? "-" : undefined,
            notebook,
            true,
          );
        }
      }

      if (!quiet) {
        message("Done");
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
    // optional process result from execution
    let result: ProcessResult | undefined;

    // execute if we need to
    if (options.format.execution[kExecute] === true) {
      // execute the notebook (save back in place)
      result = await execProcess(
        {
          cmd: [
            pythonBinary(),
            resourcePath("jupyter/jupyter.py"),
          ],
          stdout: "piped",
        },
        JSON.stringify(options),
      );
    }

    // convert to markdown
    if (!result || result.success) {
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
          toHtml: isHtmlFormat(options.format.pandoc) ||
            options.format.render[kPreferHtml] &&
              isMarkdownFormat(options.format.pandoc),
          toLatex: isLatexFormat(options.format.pandoc),
          toMarkdown: isMarkdownFormat(options.format.pandoc),
          figFormat: options.format.execution[kFigFormat],
          figDpi: options.format.execution[kFigDpi],
        },
      );
      await Deno.writeTextFile(options.output, result.markdown);

      // if it's a transient notebook then remove it, otherwise
      // sync so that jupyter[lab] can open the .ipynb w/o errors
      if (options.target.data) {
        Deno.removeSync(options.target.input);
      } else {
        await jupytextSync(options.target.input, [], true);
      }

      // return results
      return {
        supporting: [assets.supporting_dir],
        pandoc: result.includeFiles
          ? {
            [kIncludeInHeader]: result.includeFiles.inHeader,
            [kIncludeAfterBody]: result.includeFiles.afterBody,
          }
          : {},
        preserve: result.htmlPreserve,
        postprocess: !!result.htmlPreserve,
      };
    } else {
      return Promise.reject();
    }
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

function isJupytextMd(file: string) {
  const yaml = readYamlFromMarkdownFile(file);
  return Object.keys(yaml).includes("jupyter");
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
    if (!yaml.jupyter?.kernelspec) {
      filter.push("kernelspec");
    }
    if (!yaml.jupyter?.jupytext) {
      filter.push("jupytext");
    } else {
      if (!yaml.jupyter?.jupytext?.formats) {
        filter.push("jupytext.formats");
      }
      if (!yaml.jupyter?.jupytext?.text_representation) {
        filter.push("jupytext.text_representation");
      }
      if (!yaml.jupyter?.jupytext?.notebook_metadata_filter) {
        filter.push("jupytext.notebook_metadata_filter");
      }
      if (!yaml.jupyter?.jupytext?.main_language) {
        filter.push("jupytext.main_language");
      }
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

function pythonBinary(binary = "python") {
  const condaPrefix = getenv("CONDA_PREFIX");
  return condaPrefix + "/bin/" + binary;
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
  const args = [file, "--to", format];
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
  const result = await execProcess(
    {
      cmd: [
        pythonBinary("jupytext"),
        ...args,
      ],
    },
    undefined,
    (data: Uint8Array) => {
      Deno.stderr.writeSync(data);
    },
  );
  if (!result.success) {
    throw new Error(result.stderr || "Error syncing jupytext");
  }
}
