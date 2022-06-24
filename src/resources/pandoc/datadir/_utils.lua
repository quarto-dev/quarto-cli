-- debug.lua
-- Copyright (C) 2020 by RStudio, PBC

-- improved formatting for dumping tables
local function tdump (tbl, indent)
  if not indent then indent = 0 end
  if tbl.t then
    print(string.rep("  ", indent) .. tbl.t)
  end
  for k, v in pairs(tbl) do
    formatting = string.rep("  ", indent) .. k .. ": "
    if type(v) == "table" then
      print(formatting)
      tdump(v, indent+1)
    elseif type(v) == 'boolean' then
      print(formatting .. tostring(v))
    elseif (v ~= nil) then 
      print(formatting .. tostring(v))
    else 
      print(formatting .. 'nil')
    end
  end
end

-- dump an object to stdout
local function dump(o)
  if type(o) == 'table' then
    tdump(o)
  else
    print(tostring(o) .. "\n")
  end
end

return {
  dump = dump
}


