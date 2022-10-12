-- map-or-call.lua
-- Copyright (C) 2020 by RStudio, PBC

function map_or_call(fun, arrayOrValue)
  if tisarray(arrayOrValue) then
    -- array
    local result = {}
    for i, v in pairs(arrayOrValue) do
      table.insert(result, fun(v))
    end
    return result
  else
    -- value
    return fun(arrayOrValue)
  end
end
