-- params.lua
-- Copyright (C) 2020 by RStudio, PBC

-- global quarto params
quartoParams = {}

function initParams()
   quartoParams = jsonDecode(os.getenv("QUARTO_FILTER_PARAMS"))
end

function param(name, default)
  local value = quartoParams[name]
  if value == nil then
    value = default
  end
  return value
end

