-- Unit tests for src/resources/filters/modules/path.lua
--
-- Run via the Deno smoke test in tests/smoke/lua-unit/lua-unit.test.ts
-- (which sets LUA_PATH and invokes `quarto run`), or directly with:
--   LUA_PATH="tests/unit-lua/?.lua;src/resources/filters/modules/?.lua;;" \
--     package/dist/bin/quarto run tests/unit-lua/path.test.lua

local lu = require('luaunit')
local path = require('path')

-- Tests ----------------------------------------------------------------------

-- Regression test for Typst 0.15.0 hard-rejecting backslash path separators
-- (quarto-cli-ooky). Any path built with the host OS's native separator
-- (backslash on Windows) must be normalized to forward slashes before it can
-- flow into writers (e.g. Typst's image()) that reject native separators.
TestToForwardSlashes = {}

function TestToForwardSlashes:testReplacesBackslashes()
  lu.assertEquals(
    path.to_forward_slashes("a\\b\\c.png"),
    "a/b/c.png"
  )
end

function TestToForwardSlashes:testLeavesForwardSlashesUnchanged()
  lu.assertEquals(
    path.to_forward_slashes("a/b/c.png"),
    "a/b/c.png"
  )
end

function TestToForwardSlashes:testMixedSeparators()
  lu.assertEquals(
    path.to_forward_slashes("../../..\\media/table.jpg"),
    "../../../media/table.jpg"
  )
end

os.exit(lu.LuaUnit.run())
