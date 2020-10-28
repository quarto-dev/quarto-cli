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
  ExecuteOptions,
  PandocIncludes,
  PostProcessOptions,
} from "../../computation/engine.ts";
import {
  kIncludeAfterBody,
  kIncludeBeforeBody,
  kIncludeInHeader,
} from "../../config/constants.ts";

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
  const result = await options.engine.execute(options);
  return {
    output: options.output,
    supporting: result.supporting,
    pandoc: pandocIncludeFiles(result.includes),
    postprocess: result.postprocess,
  };
}

export async function postProcess(
  options: PostProcessOptions,
): Promise<void> {
  if (options.engine.postprocess) {
    return options.engine.postprocess(options);
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
        // deno-lint-ignore no-explicit-any
        (pandoc as any)[name] = [includeFile];
      }
    };
    include(kIncludeInHeader, includes.in_header);
    include(kIncludeBeforeBody, includes.before_body);
    include(kIncludeAfterBody, includes.after_body);
  }
  return pandoc;
}
