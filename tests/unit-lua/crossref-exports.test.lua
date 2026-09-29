-- Unit tests for the Route-N sanctioned exports on quarto.doc.crossref /
-- quarto.utils (see src/resources/filters/crossref/format.lua,
-- src/resources/filters/crossref/options.lua,
-- src/resources/filters/crossref/equations.lua, and
-- src/resources/filters/common/pandoc.lua).
--
-- Run via the Deno smoke test in tests/smoke/lua-unit/lua-unit.test.ts
-- (which sets LUA_PATH and invokes `quarto run`), or directly with:
--   LUA_PATH="tests/unit-lua/?.lua;src/resources/filters/modules/?.lua;\
--     src/resources/filters/crossref/?.lua;src/resources/pandoc/datadir/?.lua;;" \
--     package/dist/bin/quarto run tests/unit-lua/crossref-exports.test.lua
--
-- format.lua, options.lua, and equations.lua are `require()`d directly:
-- their top-level code is only function definitions plus the export
-- statements, so requiring them in isolation is safe with a minimal mock
-- of `param`, `_quarto`, `quarto`, and `crossref`.
--
-- common/pandoc.lua cannot be `require()`d by its module name: pandoc's
-- Lua environment preloads a module already named "pandoc" (the built-in
-- scripting API), so `require("pandoc")` returns that table before ever
-- consulting LUA_PATH, and our file is never reached. We load it with
-- `dofile()` on its absolute path instead, which runs the same top-level
-- code (definitions + the export line) without going through the module
-- cache. Its one require-time side effect, `local readqmd =
-- require("readqmd")`, resolves for real once LUA_PATH includes
-- src/resources/pandoc/datadir (added below, relative to this file), and
-- pandoc's Lua state already provides the real `pandoc` global (including
-- `pandoc.Inlines`) that readqmd's own top-level code needs.
--
-- Deliberately eight independent, individually-named assertions rather
-- than a loop over a list defined in this file: a rename that updates
-- both the export and a locally-defined list would keep a loop-based test
-- green while breaking P5's Route-N shim, which hardcodes these names.

-- Resolve this file's own absolute path so we can dofile() common/pandoc.lua
-- without depending on the process's current working directory.
local this_file = debug.getinfo(1, "S").source:sub(2) -- strip leading '@'
local unit_lua_dir = this_file:match("(.*/)")
local repo_root = unit_lua_dir .. "../../"
local common_pandoc_path = repo_root .. "src/resources/filters/common/pandoc.lua"

-- Mocks for filter-runtime globals -------------------------------------------

function param(_name, default) return default end
function readOption(_options, _name, default) return default end

_quarto = { modules = {}, ast = {}, format = {} }
quarto = { log = { debug = false }, utils = {}, doc = { crossref = {} } }
crossref = { categories = { by_ref_type = {} }, options = {} }

local lu = require('luaunit')

require('format')
require('options')
require('equations')
local ok, err = pcall(dofile, common_pandoc_path)
if not ok then
  error("failed to load common/pandoc.lua via dofile: " .. tostring(err))
end

-- quarto.doc.crossref exports (format.lua, options.lua, equations.lua) -------

TestCrossrefExports = {}

function TestCrossrefExports:testSubrefNumber()
  lu.assertNotNil(quarto.doc.crossref.subrefNumber)
end

function TestCrossrefExports:testRefPrefix()
  lu.assertNotNil(quarto.doc.crossref.refPrefix)
end

function TestCrossrefExports:testRefDelim()
  lu.assertNotNil(quarto.doc.crossref.refDelim)
end

function TestCrossrefExports:testRefHyperlink()
  lu.assertNotNil(quarto.doc.crossref.refHyperlink)
end

function TestCrossrefExports:testRefNumberOption()
  lu.assertNotNil(quarto.doc.crossref.refNumberOption)
end

-- crossref.startAppendix is nil under `crossref-numbering: external` (it is
-- only ever assigned inside the group that mode skips). A caller invoking
-- this export directly, bypassing the full render pipeline, must not crash
-- with a nil-arithmetic error on an appendix section entry.
function TestCrossrefExports:testRefNumberOptionAppendixWithNilStartAppendix()
  crossref.startAppendix = nil
  local entry = { appendix = true, order = { section = { 1 } } }
  local ok, result = pcall(quarto.doc.crossref.refNumberOption, "sec", entry)
  lu.assertTrue(ok, "refNumberOption threw with nil crossref.startAppendix: " .. tostring(result))
end

function TestCrossrefExports:testCrossrefOption()
  lu.assertNotNil(quarto.doc.crossref.crossrefOption)
end

function TestCrossrefExports:testRenderEquation()
  lu.assertNotNil(quarto.doc.crossref.renderEquation)
end

-- quarto.utils exports (common/pandoc.lua) ------------------------------------

TestUtilsExports = {}

function TestUtilsExports:testNbspString()
  lu.assertNotNil(quarto.utils.nbspString)
end

os.exit(lu.LuaUnit.run())
