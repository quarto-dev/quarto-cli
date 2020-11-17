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

import { existsSync } from "fs/exists.ts";

import { readYamlFromMarkdownFile } from "../core/yaml.ts";

import { Format, FormatPandoc } from "../config/format.ts";
import { PdfEngine } from "../config/pdf.ts";
import { Metadata } from "../config/metadata.ts";

import { rmdEngine } from "./rmd.ts";
import { jupyterEngine } from "./jupyter.ts";
import { juliaEngine } from "./julia.ts";

export interface ExecutionEngine {
  name: string;
  handle: (
    file: string,
    quiet: boolean,
  ) => Promise<ExecutionTarget | undefined>;
  metadata: (target: ExecutionTarget) => Promise<Metadata>;
  execute: (options: ExecuteOptions) => Promise<ExecuteResult>;
  postprocess: (options: PostProcessOptions) => Promise<void>;
  keepMd: (input: string) => string | undefined;
  latexmk?: (options: LatexmkOptions) => Promise<void>;
  run?: (options: RunOptions) => Promise<void>;
}

// execution target (filename and context 'cookie')
export interface ExecutionTarget {
  input: string;
  data?: unknown;
}

// execute options
export interface ExecuteOptions {
  target: ExecutionTarget;
  output: string;
  format: Format;
  tempDir: string;
  resourceDir: string;
  cwd?: string;
  params?: { [key: string]: unknown };
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
  target: ExecutionTarget;
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
    rmdEngine,
    juliaEngine,
    jupyterEngine,
  ];

  // try to find an engine
  for await (const engine of engines) {
    const target = await engine.handle(file, !!quiet);
    if (target) {
      return { target, engine };
    }
  }

  // if there is no engine, this is plain markdown
  return { target: { input: file }, engine: markdownEngine() };
}

function markdownEngine(): ExecutionEngine {
  return {
    name: "markdown",
    handle: (file: string) => Promise.resolve({ input: file }),
    metadata: (context: ExecutionTarget) =>
      Promise.resolve(readYamlFromMarkdownFile(context.input) as Metadata),
    execute: async (options: ExecuteOptions) => {
      // copy input to output (unless they are the same path)
      if (
        !existsSync(options.output) ||
        (Deno.realPathSync(options.target.input) !==
          Deno.realPathSync(options.output))
      ) {
        await Deno.copyFile(options.target.input, options.output);
      }

      return Promise.resolve({
        supporting: [],
        pandoc: {} as FormatPandoc,
      });
    },
    postprocess: (_options: PostProcessOptions) => Promise.resolve(),
    keepMd: (_input: string) => undefined,
  };
}
