-- LPEG parsing and handling for shortcodes
-- Copyright (C) 2020-2023 Posit Software, PBC

local lpeg = require('lpeg')

local function escape(s)
  return s:gsub("\\", "\\\\"):gsub("\"", "\\\"")
end

local function unescape(s)
  return s:gsub("\\\"", "\""):gsub("\\\\", "\\")
end

local id = function(s) return s end

local function trim_end(s) 
  return string.gsub(s, "%s*$", "") 
end

-- lpeg helpers
local Space = lpeg.S(" \n\t")^0

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
  return "[]{." .. quarto_shortcode_class_prefix .. "-escaped data-value=\"" .. escape("{{<" .. s .. ">}}") .. "\"}"
end

local function md_string_param(s)
  return "[]{." .. quarto_shortcode_class_prefix .. "-param data-raw=\"" .. escape(trim_end(s)) .. "\"}"
end

local function md_keyvalue_param(k, v)
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
      return "[" .. recursive_key .. v .. "]{." .. quarto_shortcode_class_prefix .. "-param}"
    else
      return "[" .. recursive_key .. "]{." .. quarto_shortcode_class_prefix .. "-param data-value=\"" .. escape(v) .. "\"}"
    end
  else
    if recursive_value then
      return "[" .. v .. "]{." .. quarto_shortcode_class_prefix .. "-param data-key=\"" .. escape(k) .. "\"}"
    else
      return "[]{." .. quarto_shortcode_class_prefix .. "-param data-key=\"" .. escape(k) .. "\"" .. 
      " data-value=\"" .. escape(v) .. "\"}"
    end
  end
end

local function md_shortcode(lst)
  local shortcode = {"["}

  for i = 1, #lst do
    table.insert(shortcode, lst[i])
  end
  table.insert(shortcode, "]{.")
  table.insert(shortcode, quarto_shortcode_class_prefix)
  table.insert(shortcode, "}")
  return table.concat(shortcode, "")
end

local function make_shortcode_parser(evaluator_table)
  local escaped_handler = evaluator_table.escaped
  local string_handler = evaluator_table.string
  local keyvalue_handler = evaluator_table.keyvalue
  local shortcode_handler = evaluator_table.shortcode

  -- rules
  local escaped_sc1 = lpeg.P("{{{<") * untilS(">}}}") / escaped_handler
  local escaped_sc2 = lpeg.P("{{</*") * untilS("*/>}}") / escaped_handler

  local sc_string = (lpeg.P("\"") * lpeg.C((1 - lpeg.P("\""))^0) * lpeg.P("\"") * Space + 
    lpeg.P("'") * lpeg.C((1 - lpeg.P("'"))^0) * lpeg.P("'") * Space +
    (- lpeg.S("'\"}>") * lpeg.C((1 - lpeg.P(" "))^1) * Space)) / id -- function(s) return { type = "string", value = s } end

  local function sc_string_skipping(skip, capture)
    if type(skip) == "string" then
      skip = lpeg.P(skip)
    end
    return (lpeg.P("\"") * lpeg.C((1 - lpeg.P("\""))^0) * lpeg.P("\"") * Space + 
      lpeg.P("'") * lpeg.C((1 - lpeg.P("'"))^0) * lpeg.P("'") * Space +
      (- lpeg.S("'\"}>") * lpeg.C(((1 - skip) - lpeg.P(" "))^1) * Space)) / (capture or string_handler) -- function(s) return { type = "string", value = s } end
  end

  -- skip :/? as well so that URLs with = in them are not treated as key/value pairs
  local sc_keyvalue = (sc_string_skipping(lpeg.S(":/?="), id) * lpeg.P("=") * Space * sc_string) / keyvalue_handler

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
    KeyShortcodeValue = (sc_string_skipping(lpeg.S(":/?="), id) * lpeg.P("=") * Space * lpeg.V("Shortcode")) / keyvalue_handler,
    Shortcode = escaped_sc1 + 
      escaped_sc2 +
      ((lpeg.P("{{<") * 
      Space * 
      into_list(
        (lpeg.V("Shortcode") + lpeg.V("KeyShortcodeValue") + sc_keyvalue + sc_string_skipping(">}}"))^1
      ) * 
      lpeg.P(">}}")) / shortcode_handler) * (Space / id)
  })

  return sc
end

-- FIXME we need a separate parser for non-markdown contexts.
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
    local unescaped = s:gsub("\\\"", "\""):gsub("\\\\", "\\")
    if unescaped ~= s then
      return s
    else
      return s:gsub(2, -2)
    end
  end)

-- local unshortcode = lpeg.P("[]{.quarto-shortcode__-param data-raw=\"") * (lpeg.P("value") / id) * lpeg.P("\"}")
local unshortcode = lpeg.P({
  "Text",
  Text = into_string((lpeg.V("Shortcodespan") + lpeg.P(1) / id)^1),
  Nonshortcode = (1 - lpeg.P("["))^1 / id,
  Shortcodekeyvalue = (lpeg.P("[]{.quarto-shortcode__-param data-key=") * escaped_string * Space * lpeg.P("data-value=") * escaped_string * lpeg.P("}")) /
    function(k, v) return k .. "=" .. v end,
  Shortcodestring = lpeg.P("[]{.quarto-shortcode__-param data-raw=") * escaped_string * lpeg.P("}"),
  -- Shortcodekeyvalue =
  Shortcodeescaped = lpeg.P("[]{.quarto-shortcode__-escaped data-value=") * 
      (escaped_string / function(s) return "{" .. unescape(s:sub(2, -2)) .. "}" end) * 
      lpeg.P("}"),
  Shortcodespan = lpeg.V"Shortcodeescaped" + lpeg.V"Shortcodekeyvalue" + lpeg.V"Shortcodestring" +
  into_list(lpeg.P("[") * lpeg.V("Shortcodespan")^0 * lpeg.P("]{.quarto-shortcode__}") * Space) / function(lst)
    return "{{< " .. table.concat(lst, " ") .. " >}}"
  end
})

return {
  md_shortcode = md_shortcode,
  make_shortcode_parser = make_shortcode_parser,
  unshortcode = unshortcode -- for undoing shortcodes in non-markdown contexts
}

-- print(md_shortcode:match([[
-- Hello world.

-- Some text here.

-- {{< foo bar baz {{< meta foo >}} bah=asdf bam="boom" 'long key'='long value' >}}

-- {{</* foo bar baz */>}}

-- {{{< more escaped stuff >}}}

-- Some more text here.

-- Goodbye world.
-- ]]))

-- p(lpeg.match(md_shortcode, "{{</* foo bar baz */>}}"))

-- p(lpeg.match(md_shortcode, "{{< foo bar baz {{< meta foo >}} bah=asdf bam=\"boom\" 'long key'='long value' >}}"))

-- print(md_shortcode:match('[{{< fa brands r-project >}} This is R]{.hidden render-id="quarto-int-navbar:{{< fa brands r-project >}} This is R"}'))
-- print(unshortcode:match("[]{.quarto-shortcode__-param data-raw=\"value\"}"))
-- print(unshortcode:match("[]{.quarto-shortcode__-param data-key=\"key\" data-value=\"value\"}"))
-- print(unshortcode:match("[[]{.quarto-shortcode__-param data-raw=\"meta\"}]{.quarto-shortcode__}"))
-- print(unshortcode:match("[]{.quarto-shortcode__-escaped data-value=\"{{< meta foo >}}\"} with stuff"))
-- print(unshortcode:match('./[[]{.quarto-shortcode__-param data-raw="meta"}[]{.quarto-shortcode__-param data-raw="bar"}]{.quarto-shortcode__}.html'))

