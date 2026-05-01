/*
 * lua-unit.test.ts
 *
 * Runs the luaunit-based Lua unit tests in tests/unit-lua/ via `quarto run`.
 *
 * Convention for a Lua unit test file:
 *   - Lives under tests/unit-lua/ and ends in `.test.lua`.
 *   - `local lu = require('luaunit')` (resolved via LUA_PATH set below).
 *   - May `require()` any module under src/resources/filters/ or
 *     src/resources/filters/modules/ (also on LUA_PATH).
 *   - Mocks any filter-runtime globals it needs (param, tcontains,
 *     format_typst_float, quarto.log.*, _quarto.*).
 *   - Ends with `os.exit(lu.LuaUnit.run())` so failures surface as a
 *     non-zero exit code, which fails this Deno test.
 *
 * To add a new Lua unit test, drop a file into tests/unit-lua/ and add its
 * relative path to LUA_TESTS below.
 */

import { fromFileUrl, join } from "../../../src/deno_ral/path.ts";
import { assert } from "testing/asserts";
import { execProcess } from "../../../src/core/process.ts";
import { quartoDevCmd } from "../../utils.ts";
import { unitTest } from "../../test.ts";

// Explicit list, relative to tests/unit-lua/. Keep alphabetized.
const LUA_TESTS: string[] = [
  "typst-css.test.lua",
];

const testsDir = fromFileUrl(new URL("../../", import.meta.url));
const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));
const unitLuaDir = join(testsDir, "unit-lua");
const filtersDir = join(repoRoot, "src", "resources", "filters");
const filterModulesDir = join(filtersDir, "modules");

// Pandoc honors LUA_PATH for `require()` resolution in lua filters.
// The `;;` at the end preserves the default search path.
const LUA_PATH = [
  join(unitLuaDir, "?.lua"),
  join(filterModulesDir, "?.lua"),
  join(filtersDir, "?.lua"),
  "",
].join(";") + ";";

for (const relPath of LUA_TESTS) {
  const luaScript = join(unitLuaDir, relPath);
  unitTest(`lua-unit > ${relPath}`, async () => {
    const result = await execProcess(
      {
        cmd: quartoDevCmd(),
        args: ["run", luaScript],
        env: { LUA_PATH },
      },
      undefined,
      undefined,
      undefined,
      true, // capture stdout/stderr
    );
    assert(
      result.success,
      `Lua unit test failed (exit ${result.code}): ${relPath}\n` +
        `--- stdout ---\n${result.stdout ?? ""}\n` +
        `--- stderr ---\n${result.stderr ?? ""}`,
    );
  });
}
