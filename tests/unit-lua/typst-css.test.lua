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

os.exit(lu.LuaUnit.run())
