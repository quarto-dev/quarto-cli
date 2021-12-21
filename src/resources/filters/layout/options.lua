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
function option(name, def)
  local val = allOptions[name]
  if val == nil then
    return def
  else
    return val
  end
end

function capLocation(scope, default, subcap)
  local prefix = "cap"
  if subcap then
    prefix = "subcap"
  end
  local loc = option(scope .. '-' .. prefix .. '-location', option('cap-location', nil))
  if loc ~= nil then
    return inlinesToString(loc)
  else
    return default
  end
end

function subcapLocation(scope, default)
  return capLocation(scope, default, true)
end

