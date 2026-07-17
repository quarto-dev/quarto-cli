/*
 * cache.test.ts
 *
 * Copyright (C) 2023 Posit Software, PBC
 */
import { dirname, join } from "path";
import { runQuarto } from "../../quarto-cmd.ts";
import { test } from "../../test.ts";
import { docs } from "../../utils.ts";
import { folderExists, noErrors, printsMessage } from "../../verify.ts";
import { fileLoader } from "../../utils.ts";
import { safeExistsSync, safeRemoveSync } from "../../../src/core/path.ts";

const testInput = fileLoader("jupyter", "cache")("test.qmd", "html")
const cacheFolder = join(dirname(testInput.input), ".jupyter_cache")

test({
  name: "Jupyter cache is working",
  execute: async (logFile?: string) => {
    // https://github.com/quarto-dev/quarto-cli/issues/9618
    // repeated executions to trigger jupyter cache; failures reach the
    // verifiers as log records, mirroring testQuartoCmd
    await runQuarto(["render", testInput.input, "--to", "html", "--no-execute-daemon"], {
      logFile,
      throwOnFailure: false,
    });
    await runQuarto(["render", testInput.input, "--to", "html", "--no-execute-daemon"], {
      logFile,
      throwOnFailure: false,
    });
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
    noErrors,
    folderExists(cacheFolder),
    // this will check only for the second render that should be read from cache
    printsMessage({ level: "INFO", regex: /Notebook read from cache/})
  ],
  type: "smoke",
});

// -- Testing changing cache folder

const testInput2 = fileLoader("jupyter", "cache-non-default")("test.qmd", "html")
// From value of cache set in _environment in test quarto project
const cacheFolder2 = join(dirname(testInput2.input), ".cache/jupyter-cache")

test({
  name: "Jupyter cache folder can be change",
  execute: async (logFile?: string) => {
    // https://github.com/quarto-dev/quarto-cli/issues/9618
    // repeated executions to trigger jupyter cache; failures reach the
    // verifiers as log records, mirroring testQuartoCmd
    await runQuarto(["render", testInput2.input, "--to", "html", "--no-execute-daemon"], {
      logFile,
      throwOnFailure: false,
    });
    await runQuarto(["render", testInput2.input, "--to", "html", "--no-execute-daemon"], {
      logFile,
      throwOnFailure: false,
    });
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
    noErrors,
    folderExists(cacheFolder2),
    // this will check only for the second render that should be read from cache
    printsMessage({level: "INFO", regex: /Notebook read from cache/})
  ],
  type: "smoke",
});