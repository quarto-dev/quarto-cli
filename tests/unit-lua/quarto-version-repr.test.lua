-- Regression test for quarto.version / quarto.config.version() always
-- supporting table.concat(), even when the `quarto-version` filter param is
-- a string pandoc.types.Version's dotted-integer parser rejects (e.g. a
-- semver build-metadata suffix like "1.9.13+test.20260910", or an entirely
-- non-numeric string). Note: pandoc.types.Version is actually lenient about
-- a trailing "-suffix" (e.g. "1.9.13-1" parses fine, silently dropping the
-- suffix) -- the "+" character is what breaks its parser, along with any
-- string that doesn't start with a digit.
--
-- On successful parsing, pandoc.types.Version returns a userdata object
-- (not a plain Lua table) that nonetheless supports table.concat() via its
-- metatable -- so this test checks table.concat() succeeds, not literal
-- Lua `type()`.
--
-- Unlike the other tests in this directory, this one is not run through
-- `quarto run` (which invokes pandoc without --data-dir, so init.lua from
-- src/resources/pandoc/datadir/ never loads). It is invoked directly against
-- pandoc with --data-dir pointing at that directory, so the real init.lua
-- runs and populates the real `quarto` global -- see
-- tests/smoke/lua-unit/quarto-version-repr.test.ts, which sets
-- QUARTO_FILTER_PARAMS to force a specific `quarto-version` filter param.
--
-- Reproduces the exact call made by the `{{< version >}}` shortcode
-- (src/resources/extensions/quarto/version/version.lua).
local lu = require('luaunit')

TestQuartoVersionRepr = {}

-- Optional: when the `expected-version` filter param is set, assert the
-- concatenated value exactly, not just that concat() didn't crash. Catches
-- silent truncation (e.g. a fixed-arity extraction pattern dropping a 4th
-- dotted component) that a crash-only check would miss.
local expectedVersion = param('expected-version', nil)

function TestQuartoVersionRepr:testVersionConcatWorks()
  local ok, result = pcall(table.concat, quarto.version, '.')
  lu.assertTrue(ok, 'table.concat(quarto.version, ".") failed: ' .. tostring(result))
  if expectedVersion then
    lu.assertEquals(result, expectedVersion)
  end
end

function TestQuartoVersionRepr:testConfigVersionConcatWorks()
  local ok, result = pcall(table.concat, quarto.config.version(), '.')
  lu.assertTrue(ok, 'table.concat(quarto.config.version(), ".") failed: ' .. tostring(result))
  if expectedVersion then
    lu.assertEquals(result, expectedVersion)
  end
end

function Pandoc(doc)
  os.exit(lu.LuaUnit.run())
end
