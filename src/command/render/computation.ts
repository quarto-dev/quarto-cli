/*
* computation.ts
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

import { FormatPandoc } from "../../config/format.ts";

import {
  computeEngineForFile,
  ExecuteOptions,
  PandocIncludes,
  PostProcessOptions,
} from "../../computation/engine.ts";

// result from computational preprocessor
export interface ComputationsResult {
  // name of file created
  output: string;
  // additional supporting files (can be removed
  // for --self-contained or pdf output)
  supporting: string[];
  // additional pandoc metadata resulting from
  // the computations
  pandoc: FormatPandoc;
  // request for a postprocessing step (the value
  // will be passed back to the postprocessor)
  postprocess?: unknown;
}

export async function runComputations(
  options: ExecuteOptions,
): Promise<ComputationsResult> {
  // compute file paths
  const engine = computeEngineForFile(options.input);

  // run compute engine if appropriate
  if (engine) {
    const result = await engine.execute(options);
    return {
      output: options.output,
      supporting: result.supporting,
      pandoc: pandocIncludeFiles(result.includes),
      postprocess: result.postprocess,
    };
    // no compute engine, just return the output
  } else {
    return {
      output: options.output,
      supporting: [],
      pandoc: {},
    };
  }
}

export async function postProcess(
  options: PostProcessOptions,
): Promise<void> {
  const engine = computeEngineForFile(options.input);
  if (engine && engine.postprocess) {
    return engine.postprocess(options);
  } else {
    return Promise.resolve();
  }
}

// provide pandoc include-* arguments from strings
function pandocIncludeFiles(
  includes?: PandocIncludes,
): FormatPandoc {
  const pandoc: FormatPandoc = {};
  if (includes) {
    const include = (name: string, value?: string) => {
      if (value) {
        const includeFile = Deno.makeTempFileSync();
        Deno.writeTextFileSync(includeFile, value);
        pandoc[name] = [includeFile];
      }
    };
    include("include-in-header", includes.in_header);
    include("include-before-body", includes.before_body);
    include("include-after-body", includes.after_body);
  }
  return pandoc;
}
