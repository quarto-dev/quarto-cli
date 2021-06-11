-- options.lua
-- Copyright (C) 2020 by RStudio, PBC


local allOptions = {}

-- initialize options from 'crossref' metadata value
function initOptions()
  return {
    Meta = function(meta)
      if meta ~= nil then
        allOptions = readOptions(meta)
      end
    end
  }
end

-- reads the options
function readOptions(meta) 
  return meta:clone()
end

-- get option value
function option(name, default)
  return parseOption(name, allOptions, default)
end

local kVarNamespace = "_quarto-vars"
function var(name, default)
  local vars = allOptions[kVarNamespace]
  return parseOption(name, vars, default)
end

function parseOption(name, options, default) 
  local keys = split(name, ".")

  local value = nil
  for i, key in ipairs(keys) do
    if value == nil then
      value = readOption(options, key, nil)
    else
      value = value[key]

      -- the key doesn't match a value, stop indexing
      if value == nil then
        break
      end
    end
  end
  return value
end