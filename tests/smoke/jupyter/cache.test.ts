/*
 * cache.test.ts
 *
 * Copyright (C) 2023 Posit Software, PBC
 */
import { dirname, join } from "path";
import { quarto } from "../../../src/quarto.ts";
import { test } from "../../test.ts";
import { docs } from "../../utils.ts";
import { folderExists, printsMessage } from "../../verify.ts";
import { fileLoader } from "../../utils.ts";
import { safeExistsSync, safeRemoveSync } from "../../../src/core/path.ts";

const testInput = fileLoader("jupyter", "cache")("test.qmd", "html")
const cacheFolder = join(dirname(testInput.input), ".jupyter_cache")

test({
  name: "Jupyter cache is working",
  execute: async () => {
    // return await new Promise((_resolve, reject) => {
    //   setTimeout(reject, 10000, "timed out after 10 seconds");
    // })
    // https://github.com/quarto-dev/quarto-cli/issues/9618
    // repeated executions to trigger jupyter cache
    await quarto(["render", testInput.input, "--to", "html", "--no-execute-daemon"]);
    await quarto(["render", testInput.input, "--to", "html", "--no-execute-daemon"]);
  },
  context: {
    teardown: async () => {
      if (safeExistsSync(cacheFolder)) {
        safeRemoveSync(cacheFolder, { recursive: true });
      }
      if (safeExistsSync(testInput.output.outputPath)) {
        safeRemoveSync(testInput.output.outputPath);
      }
      if (safeExistsSync(testInput.output.supportPath)) {
        safeRemoveSync(testInput.output.supportPath, { recursive: true });
      }
    }
  },
  verify: [
    folderExists(cacheFolder),
    // this will check only for the second render that should be read from cache
    printsMessage("INFO", /Notebook read from cache/)
  ],
  type: "smoke",
});

// -- Testing changing cache folder

const testInput2 = fileLoader("jupyter", "cache-non-default")("test.qmd", "html")
// From value of cache set in _environment in test quarto project
const cacheFolder2 = join(dirname(testInput2.input), ".cache/jupyter-cache")

test({
  name: "Jupyter cache folder can be change",
  execute: async () => {
    // return await new Promise((_resolve, reject) => {
    //   setTimeout(reject, 10000, "timed out after 10 seconds");
    // })
    // https://github.com/quarto-dev/quarto-cli/issues/9618
    // repeated executions to trigger jupyter cache
    await quarto(["render", testInput2.input, "--to", "html", "--no-execute-daemon"]);
    await quarto(["render", testInput2.input, "--to", "html", "--no-execute-daemon"]);
  },
  context: {
    teardown: async () => {
      if (safeExistsSync(cacheFolder2)) {
        safeRemoveSync(cacheFolder2, { recursive: true });
      }
      if (safeExistsSync(testInput2.output.outputPath)) {
        safeRemoveSync(testInput2.output.outputPath);
      }
      if (safeExistsSync(testInput2.output.supportPath)) {
        safeRemoveSync(testInput2.output.supportPath, { recursive: true });
      }
      if (safeExistsSync(join(dirname(testInput2.input), ".quarto"))) {
        safeRemoveSync(join(dirname(testInput2.input), ".quarto"), { recursive: true });
      }
    }
  },
  verify: [
    folderExists(cacheFolder2),
    // this will check only for the second render that should be read from cache
    printsMessage("INFO", /Notebook read from cache/)
  ],
  type: "smoke",
});