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

-- ---------------------------------------------------------------------
-- Per-feature coverage: 3 tests per feature. Failing tests document
-- known bugs; lock-in tests pin down current behavior so future refactors
-- don't drift.
-- ---------------------------------------------------------------------

-- Color: parse_opacity --------------------------------------------------
TestParseOpacity = {}

function TestParseOpacity:testPercent()
  lu.assertEquals(typst_css.parse_opacity('50%'),
    { unit = 'percent', value = 50 })
end

function TestParseOpacity:testFractionClampsToOne()
  lu.assertEquals(typst_css.parse_opacity('2'),
    { unit = 'fraction', value = 1.0 })
end

function TestParseOpacity:testInvalidNumberDoesNotCrash()
  -- BUG F: math.min(1.0, tonumber('foo')) raises 'number expected, got
  -- nil'. A bad alpha in user CSS (e.g. `rgba(0 0 0 / abc)`) would
  -- crash the filter.
  local ok, result = pcall(typst_css.parse_opacity, 'not-a-number')
  lu.assertTrue(ok, 'parse_opacity crashed: ' .. tostring(result))
  lu.assertNil(result)
end

-- Color: parse_color (hex paths; brand path is in TestParseColorBrand) -
TestParseColorHex = {}

function TestParseColorHex:testThreeDigitHexShorthand()
  lu.assertEquals(typst_css.parse_color('#abc', new_warnings()), {
    type = 'rgb',
    value = {
      { unit = 'hex', value = 0xaa },
      { unit = 'hex', value = 0xbb },
      { unit = 'hex', value = 0xcc },
    },
    rep = 'shorthex',
  })
end

function TestParseColorHex:testEightDigitHexWithAlpha()
  lu.assertEquals(typst_css.parse_color('#aabbccdd', new_warnings()), {
    type = 'rgb',
    value = {
      { unit = 'hex', value = 0xaa },
      { unit = 'hex', value = 0xbb },
      { unit = 'hex', value = 0xcc },
      { unit = 'hex', value = 0xdd },
    },
    rep = 'hex',
  })
end

function TestParseColorHex:testFiveDigitHexInvalid()
  -- BUG G: 5-digit hex is not valid CSS; it currently parses silently
  -- as 2 components because gmatch '..' drops the trailing odd digit.
  lu.assertNil(typst_css.parse_color('#fffff', new_warnings()))
end

-- Color: parse_color delegating to parse_rgb (parse_rgb is private; we
-- exercise it through the public parse_color entrypoint).
TestParseColorRgb = {}

function TestParseColorRgb:testLegacyCommaThreeComponents()
  lu.assertEquals(typst_css.parse_color('rgb(255, 0, 0)', new_warnings()), {
    type = 'rgb',
    value = {
      { unit = 'int', value = 255 },
      { unit = 'int', value = 0 },
      { unit = 'int', value = 0 },
    },
  })
end

function TestParseColorRgb:testModernSlashAlpha()
  lu.assertEquals(typst_css.parse_color('rgb(255 0 0 / 50%)', new_warnings()), {
    type = 'rgb',
    value = {
      { unit = 'int', value = 255 },
      { unit = 'int', value = 0 },
      { unit = 'int', value = 0 },
      { unit = 'percent', value = 50 },
    },
  })
end

function TestParseColorRgb:testOneCommaIsRejected()
  -- parse_color drops `warnings` when delegating to parse_rgb (a separate
  -- latent bug — see line 306), so we only assert the nil return.
  lu.assertNil(typst_css.parse_color('rgb(255, 0)', new_warnings()))
end

-- Color: output_color --------------------------------------------------
TestOutputColor = {}

function TestOutputColor:testTypstNativeNamedShortcut()
  lu.assertEquals(
    typst_css.output_color({ type = 'named', value = 'red' }, nil,
      new_warnings()),
    'red')
end

function TestOutputColor:testCssOnlyNamedFallsBackToRgb()
  -- aliceblue isn't in typst_named_colors, so output_color falls back
  -- to the rgb() form pulled from css_named_colors.
  lu.assertEquals(
    typst_css.output_color({ type = 'named', value = 'aliceblue' }, nil,
      new_warnings()),
    'rgb(240, 248, 255)')
end

function TestOutputColor:testNilColorWithOpacityIsTransparentBlack()
  lu.assertEquals(
    typst_css.output_color(nil, { unit = 'percent', value = 50 },
      new_warnings()),
    'rgb(0, 0, 0, 50%)')
end

-- Length parsing: extra coverage for parse_length_unit ----------------
function TestTranslateLength:testDvminUnitParses()
  -- BUG H: 'dvmin ' has a stray trailing space in the length_units
  -- table, so the suffix matcher falls through to the shorter 'vmin'
  -- and the unit is never recognized.
  lu.assertEquals(typst_css.parse_length_unit('10dvmin'), 'dvmin')
end

-- Border parsing: ordering + defaults ---------------------------------
function TestTranslateBorder:testKeywordWidthDottedNamedColor()
  local r = typst_css.translate_border('thick dotted blue', new_warnings())
  lu.assertEquals(r.thickness, '3.75pt') -- thick = 5px = 3.75pt
  lu.assertEquals(r.dash, '"dotted"')
  lu.assertEquals(r.paint, 'blue')
end

function TestTranslateBorder:testWidthOnlyShorthandKeepsDefaults()
  -- 'solid' default has no Typst literal so dash is nil ("let Typst
  -- pick"); paint stays as the literal string 'black' (Typst built-in).
  local r = typst_css.translate_border('1px', new_warnings())
  lu.assertEquals(r.thickness, '0.75pt')
  lu.assertNil(r.dash)
  lu.assertEquals(r.paint, 'black')
end

function TestTranslateBorder:testColorFirstOrderIsHandled()
  -- CSS shorthand is order-agnostic.
  local r = typst_css.translate_border('blue dashed 2px', new_warnings())
  lu.assertEquals(r.thickness, '1.5pt')
  lu.assertEquals(r.dash, '"dashed"')
  lu.assertEquals(r.paint, 'blue')
end

-- Font: translate_font_weight (extends existing class) ----------------
function TestTranslateFontWeight:testNumericInRange()
  lu.assertEquals(typst_css.translate_font_weight('400', new_warnings()), 400)
end

function TestTranslateFontWeight:testDashedToUndashed()
  lu.assertEquals(
    typst_css.translate_font_weight('extra-light', new_warnings()),
    'extralight')
end

function TestTranslateFontWeight:testCaseInsensitiveBold()
  -- BUG K: CSS keywords are case-insensitive but the module's tables
  -- only contain lowercase entries.
  lu.assertEquals(
    typst_css.translate_font_weight('BOLD', new_warnings()),
    'bold')
end

-- Font: translate_font_family_list ------------------------------------
TestTranslateFontFamilyList = {}

function TestTranslateFontFamilyList:testMultipleWithQuotes()
  lu.assertEquals(
    typst_css.translate_font_family_list('Helvetica, "Arial Black"'),
    '("Helvetica", "Arial Black")')
end

function TestTranslateFontFamilyList:testSingleHasTrailingComma()
  lu.assertEquals(
    typst_css.translate_font_family_list('foo'),
    '("foo",)')
end

function TestTranslateFontFamilyList:testWhitespaceOnlyIsEmpty()
  -- BUG L: '   ' yields '("",)' because the gmatch matches the
  -- whitespace run as one token, leading-space trim makes it empty,
  -- but we still emit it as a quoted empty family.
  lu.assertEquals(typst_css.translate_font_family_list('   '), '()')
end

-- Sides: expand_side_shorthand ----------------------------------------
TestExpandSideShorthand = {}

function TestExpandSideShorthand:testOneItemAllSidesEqual()
  lu.assertEquals(
    typst_css.expand_side_shorthand({'1'}, 'context', new_warnings()),
    { top = '1', right = '1', bottom = '1', left = '1' })
end

function TestExpandSideShorthand:testTwoItemRule()
  lu.assertEquals(
    typst_css.expand_side_shorthand({'1', '2'}, 'context', new_warnings()),
    { top = '1', right = '2', bottom = '1', left = '2' })
end

function TestExpandSideShorthand:testThreeItemRule()
  -- 3-item rule: top, right, bottom; left mirrors right.
  lu.assertEquals(
    typst_css.expand_side_shorthand({'1', '2', '3'}, 'context', new_warnings()),
    { top = '1', right = '2', bottom = '3', left = '2' })
end

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
