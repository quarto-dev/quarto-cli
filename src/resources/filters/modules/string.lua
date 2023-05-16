-- string.lua
-- Copyright (C) 2023 Posit Software, PBC


-- tests whether a string ends with another string
local function ends_with(str, ending) 
  return ending == "" or str:sub(-#ending) == ending
end

local function starts_with(str, starting) 
  return starting == "" or str:sub(1, #starting) == starting
end

-- trim a string
local function trim(s)
  return (string.gsub(s, "^%s*(.-)%s*$", "%1"))
end

-- splits a string on a separator
local function split(str, sep)
  local fields = {}
  
  local sep = sep or " "
  local pattern = string.format("([^%s]+)", sep)
  local _ignored = string.gsub(str, pattern, function(c) fields[#fields + 1] = c end)
  
  return fields
end

-- escape string by converting using Pandoc
local function string_escape(str, format)
  local doc = pandoc.Pandoc({pandoc.Para(str)})
  return pandoc.write(doc, format)
end

-- The character `%´ works as an escape for those magic characters. 
-- So, '%.' matches a dot; '%%' matches the character `%´ itself. 
-- You can use the escape `%´ not only for the magic characters, 
-- but also for all other non-alphanumeric characters. When in doubt, 
-- play safe and put an escape.
-- ( from http://www.lua.org/pil/20.2.html )
local function pattern_escape(str) 
  return str:gsub("([^%w])", "%%%1")
end

return {
  ends_with = ends_with,
  starts_with = starts_with,
  trim = trim,
  split = split,
  string_escape = string_escape,
  pattern_escape = pattern_escape
}