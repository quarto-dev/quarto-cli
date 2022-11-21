-- environment.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

local classEnvironments = pandoc.MetaMap({})

-- helper that identifies arrays
local function tisarray(t)
  local i = 0
  for _ in pairs(t) do
    i = i + 1
    if t[i] == nil then return false end
  end
  return true
end 

-- reads the environments
local function readEnvironments(meta)
  local env = meta['environments']
  if env ~= nil then
    if tisarray(env) then 
      -- read an array of strings
      for i,v in ipairs(env) do        
        local value = pandoc.utils.stringify(v)
        classEnvironments[value] = value
      end
    else
      -- read key value pairs
      for k,v in pairs(env) do
        local key = pandoc.utils.stringify(k)
        local value = pandoc.utils.stringify(v)
        classEnvironments[key] = value
      end
    end
  end
end

-- use the environments from metadata to 
-- emit a custom environment for latex
local function writeEnvironments(divEl)
  if quarto.doc.isFormat("latex") then
    for k,v in pairs(classEnvironments) do
      if divEl.attr.classes:includes(k) then
        -- process this into a latex environment
        local beginEnv = '\\begin' .. '{' .. v .. '}'
        local endEnv = '\n\\end{' .. v .. '}'
        
        -- if the first and last div blocks are paragraphs then we can
        -- bring the environment begin/end closer to the content
        if divEl.content[1].t == "Para" and divEl.content[#divEl.content].t == "Para" then
          table.insert(divEl.content[1].content, 1, pandoc.RawInline('tex', beginEnv .. "\n"))
          table.insert(divEl.content[#divEl.content].content, pandoc.RawInline('tex', "\n" .. endEnv))
        else
          table.insert(divEl.content, 1, pandoc.RawBlock('tex', beginEnv))
          table.insert(divEl.content, pandoc.RawBlock('tex', endEnv))
        end
        return divEl
      end
    end
  end
end

-- Run in two passes so we process metadata 
-- and then process the divs
return {
  {Meta = readEnvironments}, 
  {Div = writeEnvironments}
}
