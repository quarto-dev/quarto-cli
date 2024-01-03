-- options.lua
-- Copyright (C) 2020-2022 Posit Software, PBC


local allOptions = {}

-- initialize options from 'crossref' metadata value
function init_options()
  return {
    Meta = function(meta)
      if meta ~= nil then
        allOptions = readMetaOptions(meta)
      end
    end
  }
end

-- get option value
function option(name, def)
  return parseOption(name, allOptions, def)
end

function option_as_string(name)
  local result = option(name)
  if result == nil then
    return nil
  end
  return inlinesToString(result)
end

local kVarNamespace = "_quarto-vars"
function var(name, def)
  local vars = allOptions[kVarNamespace]
  if vars ~= nil then
    return parseOption(name, vars, def)
  else
    return nil
  end
end

function parseOption(name, options, def) 
  local keys = split(name, ".")
  quarto.log.output(keys)
  local value = nil
  for i, key in ipairs(keys) do
    if value == nil then
      value = readOption(options, key, nil)
    else
      key = tonumber(key) or key
      value = value[key]
    end

    -- the key doesn't match a value, stop indexing
    if value == nil then
      break
    end    
  end
  if value == nil then
    return def
  else
    return value
  end
end

function cap_location_from_option(scope, default)
  local loc = option(scope .. '-cap-location', option('cap-location', nil))
  if loc ~= nil then
    return inlinesToString(loc)
  else
    return default
  end
end