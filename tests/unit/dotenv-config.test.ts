/*
* environment.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { assert, assertEquals } from "testing/asserts";
import { unitTest } from "../test.ts";
import { quartoConfig } from "../../src/core/quarto.ts";

const workingDir = Deno.makeTempDirSync();

unitTest(
  "dotenv config",
  async () => {
    // force reload for the test as otherwise the cached value 
    // loaded from tests/ working dir will be used
    const dotenvConfig = await quartoConfig.dotenv(true);
    assert(
      Object.keys(dotenvConfig).length > 0,
      "Quarto dotenv config is not loading correctly",
    );
  },
  {
    setup: () => {
      // testing working dir config wrongly loaded 
      // https://github.com/quarto-dev/quarto-cli/issues/9262
      Deno.writeTextFileSync(".env.example", "TEST_VAR=")
      return Promise.resolve();
    },
    cwd: () => {
      return workingDir;
    },
    teardown: () => {
      try {
        Deno.removeSync(workingDir, { recursive: true });
      } catch {
      }
      return Promise.resolve();
    },
  }
);
