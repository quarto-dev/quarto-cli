-- LPEG parsing and handling for shortcodes
-- Copyright (C) 2020-2023 Posit Software, PBC

local lpeg = require('lpeg')

local unshortcode

local function escape(s, quote)
  quote = quote or '"'
  local result = s:gsub("\\", "\\\\"):gsub(quote, "\\" .. quote)
  return result
end

local function unescape(s, quote)
  quote = quote or '"'
  local result = s:gsub("\\" .. quote, quote):gsub("\\\\", "\\")
  return result
end

local id = function(s) return s end

local function trim_end(s) 
  local result = string.gsub(s, "%s*$", "") 
  return result
end

-- lpeg helpers
local Space = lpeg.S(" \n\t")^0
local Space1 = lpeg.S(" \n\t")^1

local function untilS(s)
  return lpeg.C((1 - lpeg.P(s))^0) * lpeg.P(s)
end

local function into_list(pattern)
  return lpeg.Cf(lpeg.Ct("") * pattern, function(list, value)
    table.insert(list, value)
    return list
  end)
end

local function into_string(pattern)
  return lpeg.Cf(lpeg.Ct("") * pattern, function(list, value)
    table.insert(list, value)
    return list
  end) / table.concat
end

-- constants
local quarto_shortcode_class_prefix = "quarto-shortcode__"

-- evaluators
local function md_escaped_shortcode(s)
  -- escaped shortcodes bring in whitespace
  return "[]{." .. quarto_shortcode_class_prefix .. "-escaped data-is-shortcode=\"1\" data-value=\"" .. escape("{{<" .. s .. ">}}") .. "\"}"
end

local function into_dataset_value(s)
  if s:sub(1, 1) == "'" then
    value = escape(unescape(s:sub(2, -2), "'"), '"')
  elseif s:sub(1, 1) == "\"" then
    value = escape(unescape(s:sub(2, -2), '"'), '"')
  else
    value = s
  end
  return value
end

local function md_string_param(s)
  local value = into_dataset_value(s)
  local result = "[]{." .. quarto_shortcode_class_prefix .. "-param data-is-shortcode=\"1\" data-value=\"" .. value .. "\" data-raw=\"" .. escape(trim_end(s)) .. "\"}"
  return result
end

local function md_keyvalue_param(k, connective, v)
  local recursive_key = false
  local recursive_value = false

  if k:sub(1, 1) == "[" then
    recursive_key = true
  end
  if v:sub(1, 1) == "[" then
    recursive_value = true
  end
  if recursive_key then
    if recursive_value then
      return "[" .. k .. v .. "]{." .. quarto_shortcode_class_prefix .. "-param data-is-shortcode=\"1\"}"
    else
      return "[" .. k .. "]{." .. quarto_shortcode_class_prefix .. "-param data-is-shortcode=\"1\" data-value=\"" .. into_dataset_value(v) .. "\"}"
    end
  else
    if recursive_value then
      return "[" .. v .. "]{." .. quarto_shortcode_class_prefix .. "-param data-is-shortcode=\"1\" data-key=\"" .. into_dataset_value(k) .. "\"}"
    else
      raw = k .. connective .. v
      return "[]{." .. quarto_shortcode_class_prefix .. "-param data-is-shortcode=\"1\" data-raw=\"" .. escape(raw) .. "\" data-key=\"" .. into_dataset_value(k) .. "\"" .. " data-value=\"" .. into_dataset_value(v) .. "\"}"
    end
  end
end

local function md_shortcode(open, space, lst, close)
  local shortcode = {"["}

  for i = 1, #lst do
    table.insert(shortcode, lst[i])
  end
  table.insert(shortcode, "]{.")
  table.insert(shortcode, quarto_shortcode_class_prefix)
  table.insert(shortcode, " data-is-shortcode=\"1\"")
  local raw = open .. space
  for i = 1, #lst do
    local un = unshortcode:match(lst[i]) 
    raw = raw .. (un or lst[i])
  end
  raw = raw .. close
  table.insert(shortcode, " data-raw=\"")
  table.insert(shortcode, escape(raw))
  table.insert(shortcode, "\"")
  table.insert(shortcode, "}")
  return table.concat(shortcode, "")
end

local double_quoted_string = into_string(lpeg.C("\"") * lpeg.C((1 - lpeg.P("\""))^0) * lpeg.C("\""))
local single_quoted_string = into_string(lpeg.C("'")  * lpeg.C((1 - lpeg.P("'"))^0)  * lpeg.C("'"))
local sc_string = (
  double_quoted_string * Space + 
  single_quoted_string * Space +
  (- lpeg.S("'\"}>") * lpeg.C((1 - lpeg.S(" \n\t"))^1) * Space)
) / id

local sc_string_no_space = (
  double_quoted_string + 
  single_quoted_string +
  (- lpeg.S("'\"}>") * lpeg.C((1 - lpeg.S(" \n\t"))^1))
) / id

local function make_shortcode_parser(evaluator_table)
  local escaped_handler = evaluator_table.escaped
  local string_handler = evaluator_table.string
  local keyvalue_handler = evaluator_table.keyvalue
  local shortcode_handler = evaluator_table.shortcode

  -- rules
  local escaped_sc1 = lpeg.P("{{{<") * untilS(">}}}")   / escaped_handler
  local escaped_sc2 = lpeg.P("{{</*") * untilS("*/>}}") / escaped_handler

  local function sc_string_skipping(skip, capture)
    if type(skip) == "string" then
      skip = lpeg.P(skip)
    end
    return (into_string(double_quoted_string) + 
      into_string(single_quoted_string) +
      (- lpeg.S("'\"}>") * lpeg.C(((1 - skip) - lpeg.S(" \n\t"))^1))) / (capture or string_handler) -- function(s) return { type = "string", value = s } end
  end

  -- skip :/? as well so that URLs with = in them are not treated as key/value pairs
  local sc_keyvalue = (sc_string_skipping(lpeg.S(":/?="), id) * lpeg.C(Space * lpeg.P("=") * Space) * sc_string_no_space) / keyvalue_handler

  local text
  if evaluator_table.ignore_pattern then
    text = (evaluator_table.ignore_pattern / id + 
      lpeg.V("Nonshortcode") + 
      lpeg.V("Shortcode"))^1
  else
    text = (lpeg.V("Nonshortcode") + 
      lpeg.V("Shortcode"))^1
  end
  local sc = lpeg.P({
    "Text",
    Text = into_string(text),
    Nonshortcode = (1 - lpeg.P("{{{<") - lpeg.P("{{<")) / id,
    KeyShortcodeValue = (sc_string_skipping(lpeg.S(":/?="), id) * Space * lpeg.P("=") * Space * lpeg.V("Shortcode")) / keyvalue_handler,
    Shortcode = escaped_sc1 + 
      escaped_sc2 +
      ((lpeg.C(lpeg.P("{{<")) * 
        lpeg.C(Space) * 
        into_list(
          (lpeg.V("Shortcode") + 
            lpeg.V("KeyShortcodeValue") + 
            sc_keyvalue + 
            (Space1 / id) +
            (sc_string_skipping(">}}") * (Space / id))
          )^1
        ) * 
        lpeg.C(Space * lpeg.P(">}}"))) / shortcode_handler) * (Space / id)
  })

  return sc
end

md_shortcode = make_shortcode_parser({
  escaped = md_escaped_shortcode,
  string = md_string_param,
  keyvalue = md_keyvalue_param,
  shortcode = md_shortcode,

  ignore_pattern = lpeg.P("{.hidden render-id=\"") * (lpeg.P(1) - lpeg.P("\"}"))^1 * lpeg.P("\"}")
})

local escaped_string = into_string(
  (lpeg.P("\"") *
  ((lpeg.P("\\\\") +
  lpeg.P("\\\"") +
  (1 - lpeg.P("\""))) ^ 0) * lpeg.P("\"")) / function(s)
    return s:gsub("\\\"", "\""):gsub("\\\\", "\\"):sub(2, -2)
  end)

-- local unshortcode = lpeg.P("[]{.quarto-shortcode__-param data-raw=\"") * (lpeg.P("value") / id) * lpeg.P("\"}")
unshortcode = lpeg.P({
  "Text",
  Text = into_string((lpeg.V("Shortcodespan") + lpeg.P(1) / id)^1),
  Nonshortcode = (1 - lpeg.P("["))^1 / id,
  Shortcodekeyvalue = (lpeg.P("[]{.quarto-shortcode__-param data-is-shortcode=\"1\" data-raw=") * escaped_string * Space * lpeg.P("data-key=") * escaped_string * Space * lpeg.P("data-value=") * escaped_string * lpeg.P("}")) /
    function(r, k, v) return r end,
  Shortcodestring = (lpeg.P("[]{.quarto-shortcode__-param data-is-shortcode=\"1\" data-value=") * escaped_string * Space * lpeg.P("data-raw=") * escaped_string * lpeg.P("}")) /
    function(v, r) return r end,
  -- Shortcodekeyvalue =
  Shortcodeescaped = lpeg.P("[]{.quarto-shortcode__-escaped data-is-shortcode=\"1\" data-value=") * 
      (escaped_string / function(s) return "{" .. unescape(s) .. "}" end) * 
      lpeg.P("}"),
  Shortcodespan = lpeg.V"Shortcodeescaped" + lpeg.V"Shortcodekeyvalue" + lpeg.V"Shortcodestring" +
  (lpeg.P("[") * (lpeg.V("Shortcodespan") * Space)^0 * (lpeg.P("]{.quarto-shortcode__ data-is-shortcode=\"1\"") * Space * lpeg.P("data-raw=") * escaped_string * Space * lpeg.P("}"))) / function(...)
    local args = {...}
    return args[#args]
  end
})

local function fail_at_line(msg)
  local info = debug.getinfo(3, "Sl")
  print(info.source .. ":" .. tostring(info.currentline) .. ": " .. msg)
  os.exit(1)
end

local function expect_equals(v1, v2)
  if v1 ~= v2 then
    fail_at_line("Expected " .. v1 .. " to equal " .. v2)
  end
end
local function expect_match(pattern, str)
  if not pattern:match(str) then
    fail_at_line("Expected " .. str .. " to match " .. tostring(pattern))
  end
end
local function expect_no_match(pattern, str)
  if pattern:match(str) then
    fail_at_line("Expected " .. str .. " to not match " .. tostring(pattern))
  end
end

if os.getenv("LUA_TESTING") ~= nil then
  expect_match(single_quoted_string, "'asdf'")
  expect_no_match(single_quoted_string, "\"asdf\"")
  expect_match(double_quoted_string, "\"asdf\"")
  expect_no_match(double_quoted_string, "'asdf'")
  expect_match(sc_string, "\"asdf\"")
  expect_match(sc_string, "'asdf'")
  expect_match(sc_string, "asdf }}>")
  expect_equals(sc_string:match("asdf }}>"), "asdf")

  local unshortcode_tests = {
    '{{{< meta >}}}',
    "{{< meta 'foo' >}}",
    "{{< meta \"foo\" >}}",
    "{{< meta bar >}}",
    "{{< meta bar >}} {{< meta bar >}}",
    "{{< meta   bar >}}",
    "{{< meta foo = bar >}}",
    "{{< meta\n  foo = bar >}}",
    "{{< meta foo = 'bar' >}}",
    '{{< meta foo = "bar" >}}',
    "{{< kbd Shift-Ctrl-Q mac=Shift-Command-Q win=Shift-Control-Q linux=Shift-Ctrl-Q >}}",
    "{{< meta k1=v1 k2=v2 >}}",
    "{{< kbd Shift-Ctrl-Q mac=Shift-Command-Q win=Shift-Control-Q >}}",
    '{{< video https://youtu.be/wo9vZccmqwc width="400" height="300" >}}',
  }
  for i, v in ipairs(unshortcode_tests) do
    expect_equals(unshortcode:match(md_shortcode:match(v)), v)
  end

  print("Tests passed")
end

-- replace multi-character code points with an escaped version
-- that contains an UUID that we can use to restore the original
-- without worrying about collisions from user code that uses
-- the same escape syntax
local function escape_unicode(txt)
  local result = {}
  for _, c in utf8.codes(txt) do
    if c > 127 then
      table.insert(result, string.format("cf5733e5-0370-4aae-8689-61bad1dd9ec0&#x%x;", c))
    else
      table.insert(result, utf8.char(c))
    end
  end
  return table.concat(result, "")
end

-- replace escaped code points with their unescaped version
local function unescape_unicode(txt)
  return txt:gsub("cf5733e5%-0370%-4aae%-8689%-61bad1dd9ec0&#x([0-9a-fA-F]+);", function (c)
    return utf8.char(tonumber(c, 16))
  end)
end

local function wrap_lpeg_match(pattern, txt)
  txt = escape_unicode(txt)
  txt = pattern:match(txt)
  if txt == nil then
    return nil
  end
  txt = unescape_unicode(txt)
  return txt
end

return {
  lpegs = {
    md_shortcode = md_shortcode,
    unshortcode = unshortcode -- for undoing shortcodes in non-markdown contexts
  },

  parse_md_shortcode = function(txt)
    return wrap_lpeg_match(md_shortcode, txt)
  end,

  -- use this to undo shortcode parsing in non-markdown contexts
  unparse_md_shortcode = function(txt)
    return wrap_lpeg_match(unshortcode, txt)
  end,

  make_shortcode_parser = make_shortcode_parser,

  -- use this to safely call an lpeg pattern with a string
  -- that contains multi-byte code points
  wrap_lpeg_match = wrap_lpeg_match
}
