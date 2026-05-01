-- Unit tests for src/resources/filters/modules/typst_css.lua
--
-- Run via the Deno smoke test in tests/smoke/lua-unit/lua-unit.test.ts
-- (which sets LUA_PATH and invokes `quarto run`), or directly with:
--   LUA_PATH="tests/unit-lua/?.lua;src/resources/filters/modules/?.lua;;" \
--     package/dist/bin/quarto run tests/unit-lua/typst-css.test.lua
--
-- The runner sets LUA_PATH so that `require('luaunit')` and
-- `require('typst_css')` resolve. We mock the small set of globals that
-- typst_css.lua expects from the Quarto Lua filter environment.

-- Mocks for filter-runtime globals -------------------------------------------

function param(_name, default) return default end

function tcontains(t, v)
  if type(t) ~= 'table' then return false end
  for _, x in ipairs(t) do
    if x == v then return true end
  end
  return false
end

-- Mirrors the implementation in
-- src/resources/filters/quarto-post/typst-css-property-processing.lua
function format_typst_float(x)
  local f = string.format('%.2f', x)
  return (f:gsub('%.00', ''):gsub('%.(%d)0', '.%1'))
end

quarto = {
  log = {
    warning = function(...) end,
    debug = function(...) end,
    error = function(...) end,
  },
}

_quarto = {
  modules = {
    brand = {
      get_color_css = function() return nil end,
      get_typography = function() return nil end,
    },
  },
  format = { typst = { css = nil } },
}

local lu = require('luaunit')
local typst_css = require('typst_css')
-- typst_css.output_color recurses via _quarto.format.typst.css.parse_color
_quarto.format.typst.css = typst_css

local function new_warnings()
  local w = {}
  function w:insert(msg) table.insert(self, msg) end
  return w
end

-- Tests ----------------------------------------------------------------------

TestTranslateBorder = {}

-- A 0px border should always collapse to "delete" (no border) regardless of
-- how the color is spelled. Regression test for
-- https://github.com/quarto-dev/quarto-cli/issues/14460
function TestTranslateBorder:testZeroPxSolidNamedColor()
  local r = typst_css.translate_border('0px solid red', new_warnings())
  lu.assertEquals(r.thickness, 'delete')
end

function TestTranslateBorder:testZeroPxSolidHex()
  local r = typst_css.translate_border('0px solid #ff0000', new_warnings())
  lu.assertEquals(r.thickness, 'delete')
end

function TestTranslateBorder:testZeroPxSolidRgb()
  local r = typst_css.translate_border('0px solid rgb(255, 0, 0)', new_warnings())
  lu.assertEquals(r.thickness, 'delete')
end

function TestTranslateBorder:testZeroPxSolidRgba()
  local r = typst_css.translate_border('0px solid rgba(255, 0, 0, 1.00)', new_warnings())
  lu.assertEquals(r.thickness, 'delete')
end

-- Width must also survive when the color is given as rgb()/rgba() rather
-- than a name or hex.
function TestTranslateBorder:testNonZeroPxSolidRgb()
  local r = typst_css.translate_border('2px solid rgb(0, 0, 255)', new_warnings())
  lu.assertEquals(r.thickness, '1.5pt')
end

function TestTranslateBorder:testNonZeroPxDashedRgba()
  local r = typst_css.translate_border('4px dashed rgba(0, 0, 255, 0.5)', new_warnings())
  lu.assertEquals(r.thickness, '3pt')
  lu.assertEquals(r.dash, '"dashed"')
end

-- Sanity checks that the same value with named/hex colors continues to work.
function TestTranslateBorder:testNonZeroPxSolidNamed()
  local r = typst_css.translate_border('2px solid red', new_warnings())
  lu.assertEquals(r.thickness, '1.5pt')
end

function TestTranslateBorder:testNonZeroPxSolidHex()
  local r = typst_css.translate_border('2px solid #ff0000', new_warnings())
  lu.assertEquals(r.thickness, '1.5pt')
end

-- consume_color is the per-token consumer used by parse_multiple when
-- handling list-valued properties such as `border-color: <c1> <c2> <c3>`.
-- Each call must consume ONE token starting at `start` and return the
-- next position. It must not skip over a leading non-functional token
-- (named/hex) to grab a later rgb()/rgba(). Same class of bug as #14460.
TestConsumeColor = {}

function TestConsumeColor:testTakesNamedTokenBeforeRgb()
  local color, newstart = typst_css.consume_color(
    'red rgb(0, 0, 255)', 1, new_warnings())
  lu.assertEquals(color, 'red')
  lu.assertEquals(newstart, 4)
end

function TestConsumeColor:testTakesHexTokenBeforeRgba()
  local _, newstart = typst_css.consume_color(
    '#ff0000 rgba(0, 0, 255, 0.5)', 1, new_warnings())
  lu.assertEquals(newstart, 8) -- past "#ff0000"
end

function TestConsumeColor:testTakesRgbAtStart()
  local color, newstart = typst_css.consume_color(
    'rgb(0, 0, 255) red', 1, new_warnings())
  lu.assertNotIsNil(color)
  lu.assertEquals(newstart, 15) -- past "rgb(0, 0, 255)"
end

-- Tests for the underlying length parsing, just to lock in current behavior.
TestTranslateLength = {}

function TestTranslateLength:testZeroPx()
  lu.assertEquals(typst_css.translate_length('0px', new_warnings()), '0pt')
end

function TestTranslateLength:testTwoPx()
  lu.assertEquals(typst_css.translate_length('2px', new_warnings()), '1.5pt')
end

function TestTranslateLength:testPassthroughPt()
  lu.assertEquals(typst_css.translate_length('12pt', new_warnings()), '12pt')
end

-- Bug A: output_color creates `zero` as an implicit global on the no-color
-- path because the local keyword is missing.
TestOutputColorGlobalLeak = {}

function TestOutputColorGlobalLeak:setUp()
  -- Make sure no prior test poisoned this global.
  rawset(_G, 'zero', nil)
end

function TestOutputColorGlobalLeak:testNoColorWithOpacityDoesNotLeakGlobal()
  typst_css.output_color(nil, { unit = 'percent', value = 50 }, new_warnings())
  lu.assertNil(rawget(_G, 'zero'),
    'output_color leaked an implicit global "zero"')
end

-- Bug B+C: parse_color of a brand reference whose name contains digits
-- (e.g. `--brand-red-50`) currently crashes because:
--   (B) the [%a--]* class only allows alphas + hyphens, so the capture fails
--       and the function falls into the error branch
--   (C) the error branch concatenates a never-defined `v` and returns
--       `null` (also undefined)
TestParseColorBrand = {}

function TestParseColorBrand:testBrandNameWithDigitsParses()
  local c = typst_css.parse_color('var(--brand-red-50)', new_warnings())
  lu.assertNotIsNil(c)
  lu.assertEquals(c.type, 'brand')
  lu.assertEquals(c.value, 'red-50')
end

function TestParseColorBrand:testMalformedBrandRefReturnsNilNoCrash()
  -- Anything matching the var(--brand- prefix but failing the name capture
  -- must not throw a Lua error; it should warn and return nil.
  local warnings = new_warnings()
  local ok, c = pcall(typst_css.parse_color, 'var(--brand-!!)', warnings)
  lu.assertTrue(ok,
    'parse_color crashed on a malformed brand ref: ' .. tostring(c))
  lu.assertNil(c)
end

-- Bug D: translate_font_weight passes `null` (an undefined global -> nil)
-- to output_warning instead of `warnings`, so the user-supplied warnings
-- collector is silently bypassed.
TestTranslateFontWeight = {}

function TestTranslateFontWeight:testInvalidWeightWarnsToCollector()
  local warnings = new_warnings()
  local result = typst_css.translate_font_weight('not-a-weight', warnings)
  lu.assertNil(result)
  lu.assertEquals(#warnings, 1,
    'expected the invalid-weight warning to land in the collector, ' ..
    'but the collector saw ' .. #warnings .. ' warning(s)')
end

-- Bug E: consume_width and consume_style write `fbeg, fend = ...` without
-- `local`, leaking them as globals. (consume_color and translate_border
-- correctly declare them local.)
TestConsumeNoGlobalLeak = {}

function TestConsumeNoGlobalLeak:setUp()
  rawset(_G, 'fbeg', nil)
  rawset(_G, 'fend', nil)
end

function TestConsumeNoGlobalLeak:testConsumeWidthDoesNotLeak()
  typst_css.consume_width('2px', 1, new_warnings())
  lu.assertNil(rawget(_G, 'fbeg'), 'consume_width leaked global "fbeg"')
  lu.assertNil(rawget(_G, 'fend'), 'consume_width leaked global "fend"')
end

function TestConsumeNoGlobalLeak:testConsumeStyleDoesNotLeak()
  typst_css.consume_style('solid', 1, new_warnings())
  lu.assertNil(rawget(_G, 'fbeg'), 'consume_style leaked global "fbeg"')
  lu.assertNil(rawget(_G, 'fend'), 'consume_style leaked global "fend"')
end

-- The module's `function parse_multiple(...)` declaration is missing
-- `local`, so loading the module installs `parse_multiple` as a global.
TestModuleNoGlobalLeak = {}

function TestModuleNoGlobalLeak:testParseMultipleNotGlobal()
  lu.assertNil(rawget(_G, 'parse_multiple'),
    'loading typst_css leaked global "parse_multiple"')
end

-- Every key listed on the LHS of the module's `return { ... }` table
-- should resolve to a non-nil value on the loaded module. A `K = V,`
-- entry where `V` is undefined silently turns the export into nil
-- (Lua tables drop nil-valued keys), so `pairs(typst_css)` cannot see
-- the bug — we have to read the source.
TestModuleExports = {}

function TestModuleExports:testNoPhantomExports()
  local source_path = package.searchpath('typst_css', package.path)
  lu.assertNotNil(source_path, 'could not find typst_css.lua source')
  local f = assert(io.open(source_path, 'r'))
  local src = f:read('*all')
  f:close()

  -- Anchor on `\nreturn {` and `\n}` so we pick the top-level export
  -- block, not an indented `return { ... }` inside a function body.
  local export_body = src:match('\nreturn%s*{(.-)\n}%s*$')
  lu.assertNotNil(export_body, 'could not locate top-level export table')

  local nils = {}
  for k in export_body:gmatch('([%w_]+)%s*=') do
    if typst_css[k] == nil then
      table.insert(nils, k)
    end
  end
  lu.assertEquals(#nils, 0,
    'phantom exports (LHS in source but nil on module): ' ..
    table.concat(nils, ', '))
end

os.exit(lu.LuaUnit.run())
