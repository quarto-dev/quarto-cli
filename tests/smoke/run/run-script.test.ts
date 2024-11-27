import { basename, join } from "../../../src/deno_ral/path.ts";
import { ensureDirSync } from "../../../src/deno_ral/fs.ts";
import { assert, assertEquals } from "testing/asserts";
import { execProcess } from "../../../src/core/process.ts";
import { quartoDevCmd } from "../../utils.ts";
import { unitTest } from "../../test.ts";
import { EOL } from "fs/eol";
import { lines } from "../../../src/core/text.ts";

const workingDir = Deno.makeTempDirSync();

ensureDirSync(workingDir);

const ensureStreams = (name: string, script: string, stdout: string, stderr: string) => {
  unitTest(name, async () => {
    const result = await execProcess({
        cmd: [
          quartoDevCmd(),
          "run",
          basename(script),
        ],
        // disable logging here to allow for checking the output
        env: {
          "QUARTO_LOG_LEVEL": "CRITICAL",
        }
      },
      undefined,
      undefined,
      undefined,
      true
    );
    assert(result.success);
    assertEquals((result.stdout ?? "").replaceAll("\r", ""), stdout);
    assertEquals((result.stderr ?? "").replaceAll("\r", ""), stderr);
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
  })
}

const testRunCmd = (name: string, script: string) => {
  unitTest(name, async () => {
    const result = await execProcess({
      cmd: [
        quartoDevCmd(),
        "run",
        basename(script),
      ]
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

// check stream outputs

// in R
const rScript2 = join(workingDir, "test2.R");
Deno.writeTextFileSync(rScript2, "cat('write stdout\\n', file = stdout()); cat('write stderr\\n', file = stderr())");
ensureStreams("run-r-script-stdout-stderr", rScript2, "write stdout\n", "write stderr\n");

// in Python
const pyScript2 = join(workingDir, "test2.py");
Deno.writeTextFileSync(pyScript2, "import sys; print('write stdout'); print('write stderr', file = sys.stderr)");
ensureStreams("run-py-script-stdout-stderr", pyScript2, "write stdout\n", "write stderr\n");

// in Deno TS
const tsScript2 = join(workingDir, "test2.ts");
Deno.writeTextFileSync(tsScript2, "console.log('write stdout'); console.error('write stderr')");
ensureStreams("run-ts-script-stdout-stderr", tsScript2, "write stdout\n", "write stderr\n");

// in Lua
const luaScript2 = join(workingDir, "test2.lua");
Deno.writeTextFileSync(luaScript2, "print('write stdout'); io.stderr:write('write stderr\\n')");
ensureStreams("run-lua-script-stdout-stderr", luaScript2, "write stdout\n\n", "write stderr\n"); // don't know why there is an extra newline