-- LPEG "parsing" and code for fenced div workarounds
-- Copyright (C) 2024 Posit Software, PBC

local lpeg = require('lpeg')
local colons = lpeg.P(':')^3
local maybe_spaces = lpeg.S("\t ")^0
local newline = lpeg.P("\n")

local single_quoted_string = lpeg.C(lpeg.P("'") * (lpeg.P("\\'") + (lpeg.P(1) - lpeg.P("'")))^0 * lpeg.P("'"))
local double_quoted_string = lpeg.C(lpeg.P('"') * (lpeg.P('\\"') + (lpeg.P(1) - lpeg.P('"')))^0 * lpeg.P('"'))
local literal = lpeg.C(
  (lpeg.R("az", "AZ") + lpeg.S("_#.=")) *
  (lpeg.R("az", "AZ", "09") + lpeg.S(".=-_"))^0
)
local Cp = lpeg.Cp()

local function anywhere(p)
  return lpeg.P{ p + 1 * lpeg.V(1) }
end
local function anywhere_pos(p)
  return lpeg.P{ Cp * p * Cp + 1 * lpeg.V(1) }
end

local div_attr_block = lpeg.P("{") * maybe_spaces * ((single_quoted_string + double_quoted_string + literal) * maybe_spaces)^0 * lpeg.P("}")

local start_div = colons * maybe_spaces * div_attr_block * (newline + lpeg.P(-1))
local start_div_search = anywhere_pos(start_div)

local function first_and_last(...)
  local arg = {...}
  local n = #arg
  return arg[1], arg[n]
end

local single_quote_p = anywhere(lpeg.P("'"))
local double_quote_p = anywhere(lpeg.P('"'))
local bad_equals = anywhere_pos(lpeg.P("= ") + (lpeg.P(" =") * lpeg.P(" ")^-1))

local function attempt_to_fix_fenced_div(txt)
  local b, e = first_and_last(start_div_search:match(txt))
  while b do
    local substring = txt:sub(b, e - 1)
    local function count(txt, p, b)
      local result = 0
      if not b then
        b = 1
      end
      while b do
        b = p:match(txt, b)
        if b then
          result = result + 1
        end
      end
      return result
    end
    -- now we try to find the dangerous `=` with spaces around it
    -- the best heuristic we have at the moment is to look for a ` = `, `= ` or ` =`
    -- and then attempt to rule out that the `=` is part of a quoted string
    -- if `=` is not part of a quoted string, then we'll have an even number of single and double quotes
    -- to the left and right of the `=`
    -- if there's a total odd number of quotes, then this is a badly formatted key-value pair
    -- for a _different_ reason, so we do nothing

    local bad_eq, bad_eq_end = bad_equals:match(substring)
    if bad_eq then
      local total_single = count(substring, single_quote_p)
      local total_double = count(substring, double_quote_p)
      local right_single = count(substring, single_quote_p, bad_eq_end)
      local right_double = count(substring, double_quote_p, bad_eq_end)
      local left_single = total_single - right_single
      local left_double = total_double - right_double
      if left_single % 2 == 0 and right_single % 2 == 0 and left_double % 2 == 0 and right_double % 2 == 0 then
        -- we have a bad key-value pair
        -- we need to replace the `=` with _no spaces_
        local replacement = substring:sub(1, bad_eq - 1) .. "=" .. substring:sub(bad_eq_end)
        local pad_length = #replacement - #substring

        -- in order to keep the string length the same, we need add spaces to the end of the block
        txt = txt:sub(1, b - 1) .. replacement .. txt:sub(e) .. (" "):rep(pad_length)

        -- if substitution was made, we need to search at the beginning again
        -- to find the next bad key-value pair in the same block
        b, e = first_and_last(start_div_search:match(txt, b))
      else
        b, e = first_and_last(start_div_search:match(txt, e))
      end
    else
      b, e = first_and_last(start_div_search:match(txt, e))
    end
  end
  return txt
end

---------------------------------------------------

local div_attr_block_tests = {
  "{#id .class key='value'}",
  "{#id .class key=value}",
  '{#id .class key="value with spaces"}',
}

local div_block_tests = {
  "::: {#id .class key='value'}",
  "::: {#id .class key=value}",
  '::: {#id .class key="value with spaces"}',
}
local end_to_end_tests = {
  "::: {#id-1 .class key =value}\nfoo\n:::\n\n::: {#id-2 .class key='value'}\nfoo\n:::\n",
  "::: {#id-1 .class key = value}\nfoo\n:::\n\n::: {#id-2 .class key='value'}\nfoo\n:::\n",
  "::: {#id-1 .class key= value}\nfoo\n:::\n\n::: {#id-2 .class key='value'}\nfoo\n:::\n",
  "::: {#id-1 .class key =value}\nfoo\n:::\n\n::: {#id-2 .class key= 'value'}\nfoo\n:::\n",
  "::: {#id-1 .class key = value}\nfoo\n:::\n\n::: {#id-2 .class key = 'value'}\nfoo\n:::\n",
  "::: {#id-1 .class key= value}\nfoo\n:::\n\n::: {#id-2 .class key ='value'}\nfoo\n:::\n",
  "::: {#id-1 .class key= value please='do not touch = this one'}\nfoo\n:::",
  "::: {#id-1 .class key= value key2 =value2}\nfoo\n:::",
  "::: {#id-4 key =  value}\nfoo\n:::",
}

local function tests()
  for _, test in ipairs(div_attr_block_tests) do
    print(div_attr_block:match(test))
  end
  for _, test in ipairs(div_block_tests) do
    print(start_div_search:match(test))
  end
  for _, test in ipairs(end_to_end_tests) do
    print(attempt_to_fix_fenced_div(test))
    print("---")
  end
end

return {
  _tests = tests,
  attempt_to_fix_fenced_div = attempt_to_fix_fenced_div
}