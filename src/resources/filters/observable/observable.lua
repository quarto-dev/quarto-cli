


-- blocks

function CodeBlock(el)
  if el.attr.classes:find("{ojs}") then

  end
end

function DisplayMath(el)

end

function RawBlock(el)
  if el.format == "html" then

  elseif el.format == "tex" then
  
  end
end


-- inlines

function Math(el)
  return pandoc.Code(el.text)
end

function RawInline(el)
 
end

function Str(el)
  -- https://pandoc.org/lua-filters.html#macro-substitution
end


-- debug.lua
-- Copyright (C) 2020 by RStudio, PBC

-- dump an object to stdout
function dump(o)
  if type(o) == 'table' then
    tdump(o)
  else
    print(tostring(o) .. "\n")
  end
end

-- improved formatting for dumping tables
function tdump (tbl, indent)
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
    else
      print(formatting .. v)
    end
  end
end







