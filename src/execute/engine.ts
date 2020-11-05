/*
* engine.ts
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

import { Format, FormatPandoc } from "../config/format.ts";
import { PdfEngine } from "../config/pdf.ts";
import { Metadata } from "../config/metadata.ts";

import { rmdEngine } from "./rmd.ts";
import { jupyterEngine } from "./jupyter.ts";
import { readYamlFromMarkdownFile } from "../core/yaml.ts";

export interface ExecutionEngine {
  name: string;
  handle: (file: string, quiet: boolean) => Promise<string | undefined>;
  metadata: (input: string) => Promise<Metadata>;
  execute: (options: ExecuteOptions) => Promise<ExecuteResult>;
  postprocess: (options: PostProcessOptions) => Promise<void>;
  keepMd: (input: string) => string | undefined;
  latexmk?: (options: LatexmkOptions) => Promise<void>;
  run?: (options: RunOptions) => Promise<void>;
}

// execute options
export interface ExecuteOptions {
  input: string;
  output: string;
  format: Format;
  tempDir: string;
  resourceDir: string;
  cwd?: string;
  params?: string | { [key: string]: unknown };
  quiet?: boolean;
}

// result of execution
export interface ExecuteResult {
  supporting: string[];
  pandoc: FormatPandoc;
  postprocess?: unknown;
}

// post processing options
export interface PostProcessOptions {
  engine: ExecutionEngine;
  input: string;
  format: Format;
  output: string;
  data: unknown;
  quiet?: boolean;
}

// latexmk options
export interface LatexmkOptions {
  input: string;
  engine: PdfEngine;
  clean?: boolean;
  quiet?: boolean;
}

// run options
export interface RunOptions {
  input: string;
  render: boolean;
  port?: number;
  quiet?: boolean;
}

export async function executionEngine(file: string, quiet?: boolean) {
  const engines = [
    jupyterEngine,
    rmdEngine,
  ];

  // try to find an engine
  for await (const engine of engines) {
    const input = await engine.handle(file, !!quiet);
    if (input) {
      return { input, engine };
    }
  }

  // if there is no engine, this is plain markdown
  return { input: file, engine: markdownEngine() };
}

function markdownEngine(): ExecutionEngine {
  return {
    name: "markdown",
    handle: (file: string) => Promise.resolve(file),
    metadata: (file: string) =>
      Promise.resolve(readYamlFromMarkdownFile(file) as Metadata),
    execute: async (options: ExecuteOptions) => {
      await Deno.copyFile(options.input, options.output);
      return Promise.resolve({
        supporting: [],
        pandoc: {} as FormatPandoc,
      });
    },
    postprocess: (_options: PostProcessOptions) => Promise.resolve(),
    keepMd: (_input: string) => undefined,
  };
}
