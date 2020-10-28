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

import { extname } from "path/mod.ts";

import { Format } from "../config/format.ts";
import { PdfEngine } from "../config/pdf.ts";
import { Metadata } from "../config/metadata.ts";

import { rmdEngine } from "./rmd.ts";
import { ipynbEngine } from "./ipynb.ts";
import { readYamlFromMarkdownFile } from "../core/yaml.ts";

// execute options
export interface ExecuteOptions {
  engine: ComputationEngine;
  input: string;
  output: string;
  format: Format;
  cwd?: string;
  params?: string | { [key: string]: unknown };
  quiet?: boolean;
}

// result of execution
export interface ExecuteResult {
  supporting: string[];
  includes: PandocIncludes;
  postprocess?: unknown;
}

// text to include in pandoc output
export interface PandocIncludes {
  in_header?: string;
  before_body?: string;
  after_body?: string;
}

// post processing options
export interface PostProcessOptions {
  engine: ComputationEngine;
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
}

export interface ComputationEngine {
  name: string;
  handle: (file: string) => Promise<string | undefined>;
  metadata: (input: string) => Promise<Metadata>;
  execute: (options: ExecuteOptions) => Promise<ExecuteResult>;
  postprocess: (options: PostProcessOptions) => Promise<void>;
  latexmk?: (options: LatexmkOptions) => Promise<void>;
  run?: (options: RunOptions) => Promise<void>;
}

export async function computationEngine(file: string) {
  const engines = [
    ipynbEngine,
    rmdEngine,
  ];

  // try to find an engine
  for await (const engine of engines) {
    const input = await engine.handle(file);
    if (input) {
      return { input, engine };
    }
  }

  // if there is no engine, this is plain markdown
  return { input: file, engine: markdownEngine() };
}

function markdownEngine(): ComputationEngine {
  return {
    name: "markdown",
    handle: (file: string) => Promise.resolve(file),
    metadata: (file: string) =>
      Promise.resolve(readYamlFromMarkdownFile(file) as Metadata),
    execute: async (options: ExecuteOptions) => {
      await Deno.copyFile(options.input, options.output);
      return Promise.resolve({
        supporting: [],
        includes: {} as PandocIncludes,
      });
    },
    postprocess: (_options: PostProcessOptions) => Promise.resolve(),
  };
}
