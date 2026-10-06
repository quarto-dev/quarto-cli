-- Unit tests for src/resources/filters/modules/mediabag.lua
--
-- Run via the Deno smoke test in tests/smoke/lua-unit/lua-unit.test.ts
-- (which sets LUA_PATH and invokes `quarto run`), or directly with:
--   LUA_PATH="tests/unit-lua/?.lua;src/resources/filters/modules/?.lua;;" \
--     package/dist/bin/quarto run tests/unit-lua/mediabag.test.lua

-- Mocks for filter-runtime globals -------------------------------------------

local param_values = {}
function param(name, default)
  if param_values[name] ~= nil then return param_values[name] end
  return default
end

function warn(_msg) end

_quarto = {
  file = {
    write = function(_path, _contents) return true end,
  },
}

local lu = require('luaunit')
local mediabag = require('mediabag')

-- Tests ----------------------------------------------------------------------

-- Regression test for Typst 0.15.0 hard-rejecting backslash path separators
-- in image() calls (quarto-cli-fpil). pandoc.path.join uses the host OS's
-- native separator, which is a backslash on Windows. Any path handed to
-- el.src must use forward slashes only, since it flows straight into
-- writers (e.g. Typst's image()) that may not accept native separators.
TestWriteMediabagEntry = {}

function TestWriteMediabagEntry:setUp()
  param_values = { ["mediabag-dir"] = "imgtest_files/mediabag" }
  pandoc.mediabag.insert("png-base64,abc123.png", "image/png", "fake-bytes")
end

function TestWriteMediabagEntry:tearDown()
  pandoc.mediabag.empty()
end

function TestWriteMediabagEntry:testResultHasNoBackslash()
  local path = mediabag.write_mediabag_entry("png-base64,abc123.png")
  lu.assertNotNil(path)
  lu.assertNil(path:find('\\', 1, true),
    'write_mediabag_entry returned a path with a backslash: ' .. path)
end

function TestWriteMediabagEntry:testResultJoinsDirAndFilename()
  local path = mediabag.write_mediabag_entry("png-base64,abc123.png")
  lu.assertEquals(path, "imgtest_files/mediabag/png-base64,abc123.png")
end

os.exit(lu.LuaUnit.run())
