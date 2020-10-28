/*
* run.ts
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

import { ProcessResult, processSuccessResult } from "../../core/process.ts";

import { computationEngine, RunOptions } from "../../computation/engine.ts";

import { render } from "../render/render.ts";

export async function run(options: RunOptions): Promise<ProcessResult> {
  const { input, engine } = await computationEngine(options.input);
  if (engine?.run) {
    // render if requested
    if (options.render) {
      const result = await render(input, {});
      if (!result.success) {
        return result;
      }
    }
    // run (never returns)
    await engine.run({ ...options, input });
    return processSuccessResult();
  } else {
    return Promise.reject(
      new Error("Unable to run computations for input file"),
    );
  }
}
