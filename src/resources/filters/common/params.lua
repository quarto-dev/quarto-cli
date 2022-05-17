-- params.lua
-- Copyright (C) 2020 by RStudio, PBC

-- global quarto params
quartoParams = {}

function initParams()
  local paramsJson = base64_decode(os.getenv("QUARTO_FILTER_PARAMS"))
  quartoParams = json.decode(paramsJson)
end

function param(name, default)
  local value = quartoParams[name]
  if value == nil then
    value = default
  end
  return value
end

