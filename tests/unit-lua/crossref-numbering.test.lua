-- Unit tests for src/resources/filters/modules/crossref_numbering.lua
--
-- Run via the Deno smoke test in tests/smoke/lua-unit/lua-unit.test.ts
-- (which sets LUA_PATH and invokes `quarto run`), or directly with:
--   LUA_PATH="tests/unit-lua/?.lua;src/resources/filters/modules/?.lua;;" \
--     package/dist/bin/quarto run tests/unit-lua/crossref-numbering.test.lua
--
-- Drives the 2x2 cross-product of (enable-crossref, crossref-numbering)
-- plus an unknown-value row for crossref-numbering, asserting each
-- predicate's boolean value. Written as literal per-case assertions
-- (not a loop over a table of cases): each case gets its own named test
-- so a regression names the exact failing cell instead of a single
-- generic loop failure.

local mocked_params = {}

-- Mock for the filter-runtime global `param()`. crossref_numbering.lua
-- calls param("enable-crossref", true) and
-- param("crossref-numbering", "quarto") directly; this mock returns
-- whatever the test has staged, falling back to the caller-supplied
-- default when a key hasn't been staged.
function param(name, default)
  local staged = mocked_params[name]
  if staged == nil then
    return default
  end
  return staged
end

local function set_params(enable_crossref, crossref_numbering)
  mocked_params = {
    ["enable-crossref"] = enable_crossref,
    ["crossref-numbering"] = crossref_numbering,
  }
end

local lu = require('luaunit')
local crossref_numbering = require('crossref_numbering')

-- crossref_present(): should captions/refs still be decorated? ---------

TestCrossrefPresent = {}

function TestCrossrefPresent:testEnabledQuartoNumbering()
  set_params(true, "quarto")
  lu.assertEquals(crossref_numbering.crossref_present(), true)
end

function TestCrossrefPresent:testDisabledQuartoNumbering()
  set_params(false, "quarto")
  lu.assertEquals(crossref_numbering.crossref_present(), false)
end

function TestCrossrefPresent:testEnabledExternalNumbering()
  set_params(true, "external")
  lu.assertEquals(crossref_numbering.crossref_present(), true)
end

function TestCrossrefPresent:testDisabledExternalNumbering()
  -- The only cell that distinguishes `enableCrossRef or external` from
  -- `enableCrossRef` alone: crossref is off, but an external numberer
  -- is supplying numbers, so captions/refs must still be presented.
  set_params(false, "external")
  lu.assertEquals(crossref_numbering.crossref_present(), true)
end

function TestCrossrefPresent:testEnabledUnknownNumberingValue()
  -- Unknown-value discriminator: "bogus" is neither "quarto" nor
  -- "external", so it must not be treated as "external".
  set_params(true, "bogus")
  lu.assertEquals(crossref_numbering.crossref_present(), true)
end

-- assign_crossref_numbers(): should quarto compute/assign numbers itself? --

TestAssignCrossrefNumbers = {}

function TestAssignCrossrefNumbers:testEnabledQuartoNumbering()
  set_params(true, "quarto")
  lu.assertEquals(crossref_numbering.assign_crossref_numbers(), true)
end

function TestAssignCrossrefNumbers:testDisabledQuartoNumbering()
  set_params(false, "quarto")
  lu.assertEquals(crossref_numbering.assign_crossref_numbers(), false)
end

function TestAssignCrossrefNumbers:testEnabledExternalNumbering()
  -- The real external case: quarto must not assign its own numbers when
  -- an external numberer is in control.
  set_params(true, "external")
  lu.assertEquals(crossref_numbering.assign_crossref_numbers(), false)
end

function TestAssignCrossrefNumbers:testDisabledExternalNumbering()
  set_params(false, "external")
  lu.assertEquals(crossref_numbering.assign_crossref_numbers(), false)
end

function TestAssignCrossrefNumbers:testEnabledUnknownNumberingValue()
  -- Unknown-value discriminator: "bogus" is neither "quarto" nor
  -- "external", so it must not be treated as "external" and numbering
  -- assignment stays on.
  set_params(true, "bogus")
  lu.assertEquals(crossref_numbering.assign_crossref_numbers(), true)
end

os.exit(lu.LuaUnit.run())
