/*
* github-issue-1340.test.ts
*
* Copyright (C) 2022 Posit Software, PBC
*
*/

import { docs, fileLoader, outputForInput } from "../../utils.ts";
import {
  ensureHtmlElements,
  ensureHtmlSelectorSatisfies,
  verifyPath,
} from "../../verify.ts";
import { testRender } from "../../smoke/render/render.ts";
import { ExecuteOutput } from "../../test.ts";
import { join } from "../../../src/deno_ral/path.ts";

const input = docs("bug-repros/issue-1340/");
const output = join(input, "_book");
// const output = outputForInput(join(input, "index.qmd"), "html"); <- doesn't work for book projects, right.
testRender(input, "html", false, [{
  name: "file exists",
  verify: (_outputs: ExecuteOutput[]): Promise<void> => {
    verifyPath(
      join(
        output,
        "index_files",
        "figure-html",
        "plot1-1.png",
      ),
    );
    return Promise.resolve();
  },
}, {
  name: "manual cleanup for book project",
  verify: (_outputs: ExecuteOutput[]): Promise<void> => {
    Deno.removeSync(output, { recursive: true });
    Deno.removeSync(join(input, ".quarto"), { recursive: true });
    Deno.removeSync(join(input, ".gitignore"));

    return Promise.resolve();
  },
}]);
