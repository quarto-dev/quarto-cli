-- string.lua
-- Copyright (C) 2020 by RStudio, PBC


-- tests whether a string ends with another string
function endsWith(str, ending) 
  return ending == "" or str:sub(-#ending) == ending
end

function startsWith(str, starting) 
  return starting == "" or str:sub(1, #starting) == starting
end

-- trim a string
function trim(s)
  return (string.gsub(s, "^%s*(.-)%s*$", "%1"))
end

-- splits a string on a separator
function split(str, sep)
  local fields = {}
  
  local sep = sep or " "
  local pattern = string.format("([^%s]+)", sep)
  string.gsub(str, pattern, function(c) fields[#fields + 1] = c end)
  
  return fields
end

-- escape string by converting using Pandoc
function inlineEscape(str, format)
  local doc = pandoc.Pandoc({pandoc.Para(str)})
  return pandoc.write(doc, 'latex')
end