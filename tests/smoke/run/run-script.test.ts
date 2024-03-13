import { basename, join } from "../../../src/deno_ral/path.ts";
import { ensureDirSync } from "fs/mod.ts";
import { assert } from "testing/asserts.ts";
import { execProcess } from "../../../src/core/process.ts";
import { quartoDevCmd } from "../../utils.ts";
import { unitTest } from "../../test.ts";

const workingDir = Deno.makeTempDirSync();

ensureDirSync(workingDir);

const testRunCmd = (name: string, script: string) => {
  unitTest(name, async () => {
    const result = await execProcess({
      cmd: [
        quartoDevCmd(),
        "run",
        basename(script),
      ],
    });
    assert(result.success);
  }, 
  {
    teardown: () => {
      try {
        Deno.removeSync(basename(script));
      } catch (_e) {
        // ignore
      }
      return Promise.resolve();
    },
    cwd: () => {
      return workingDir;
    }
  });
}

// Run Lua Script
const luaScript = join(workingDir, "test.lua");
Deno.writeTextFileSync(luaScript, "print('Hello, world!')");
testRunCmd("run-lua-script", luaScript);

// Run ts script
const tsScript = join(workingDir, "test.ts");
Deno.writeTextFileSync(tsScript, "console.log('Hello, world!')");
testRunCmd("run-ts-script", tsScript);

// Run Python script
const pyScript = join(workingDir, "test.py");
Deno.writeTextFileSync(pyScript, "print('Hello, world!')");
testRunCmd("run-py-script", pyScript);

// Run R script
const rScript = join(workingDir, "test.R");
Deno.writeTextFileSync(rScript, "print('Hello, world!')");
testRunCmd("run-r-script", rScript);