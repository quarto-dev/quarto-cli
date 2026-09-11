/*
 * quarto-version-repr.test.ts
 *
 * Regression test for quarto.version / quarto.config.version() always being
 * a pandoc Version object (table), even when the `quarto-version` filter
 * param carries semver build metadata or a prerelease suffix that pandoc's
 * dotted-integer Version parser rejects (e.g. "1.9.13+test.20260910" or
 * "1.9.13-1"). Such strings reach quarto-version via QUARTO_FORCE_VERSION,
 * a packager-appended revision suffix, or CI build-metadata stamping
 * (test-smokes-built.yml).
 *
 * Unlike tests/smoke/lua-unit/lua-unit.test.ts, this does not go through
 * `quarto run` -- that invokes pandoc without --data-dir, so init.lua from
 * src/resources/pandoc/datadir/ (which defines quarto.version /
 * quarto.config.version()) never loads. Instead this invokes pandoc
 * directly with --data-dir pointing at that directory, forcing the
 * quarto-version filter param via QUARTO_FILTER_PARAMS -- the same
 * mechanism a real quarto render uses (src/command/render/filters.ts,
 * src/command/render/pandoc.ts).
 */

import { encodeBase64 } from "encoding/base64";
import { fromFileUrl, join } from "../../../src/deno_ral/path.ts";
import { assert } from "testing/asserts";
import { execProcess } from "../../../src/core/process.ts";
import { pandocBinaryPath, resourcePath } from "../../../src/core/resources.ts";
import { unitTest } from "../../test.ts";

const testsDir = fromFileUrl(new URL("../../", import.meta.url));
const unitLuaDir = join(testsDir, "unit-lua");
const luaScript = join(unitLuaDir, "quarto-version-repr.test.lua");

// The `;;` at the end preserves the default search path.
const LUA_PATH = [join(unitLuaDir, "?.lua"), ""].join(";") + ";";

// A plain dotted-integer version parses fine under pandoc.types.Version --
// this case must keep working (regression guard for the normal case). The
// four-component case guards against a fixed-arity extraction silently
// truncating a version with more components than it hard-codes. The other
// two are strings pandoc.types.Version's parser rejects: a build-metadata
// suffix (as CI's test-smokes-built.yml stamps via QUARTO_FORCE_VERSION, and
// as a distro packager might append) and a version with no leading digit at
// all.
const VERSION_CASES: Record<string, { input: string; expected: string }> = {
  "plain numeric version": { input: "1.9.13", expected: "1.9.13" },
  "four-component version": { input: "1.2.3.4", expected: "1.2.3.4" },
  "build-metadata suffixed version": {
    input: "1.9.13+test.20260910",
    expected: "1.9.13",
  },
  "non-numeric version": { input: "unknown", expected: "0" },
};

for (
  const [label, { input: versionString, expected }] of Object.entries(
    VERSION_CASES,
  )
) {
  unitTest(`quarto-version-repr > ${label}`, async () => {
    const filterParams = encodeBase64(
      JSON.stringify({
        "quarto-version": versionString,
        "expected-version": expected,
      }),
    );
    const result = await execProcess(
      {
        cmd: pandocBinaryPath(),
        args: [
          "--data-dir",
          resourcePath("pandoc/datadir"),
          "--from",
          "markdown",
          "--to",
          "plain",
          "--lua-filter",
          luaScript,
        ],
        env: {
          LUA_PATH,
          QUARTO_FILTER_PARAMS: filterParams,
          QUARTO_SHARE_PATH: resourcePath(),
        },
      },
      "test\n",
      undefined,
      undefined,
      true, // capture stdout/stderr
    );
    assert(
      result.success,
      `quarto.version / quarto.config.version() were not a Version object ` +
        `for quarto-version="${versionString}" (exit ${result.code}):\n` +
        `--- stdout ---\n${result.stdout ?? ""}\n` +
        `--- stderr ---\n${result.stderr ?? ""}`,
    );
  });
}
