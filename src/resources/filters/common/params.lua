-- params.lua
-- Copyright (C) 2020 by RStudio, PBC

-- global quarto params
quartoParams = {}

function initParams()
   return {
    Pandoc = function(doc)
      if type(doc.meta["quarto-params"]) == "table" then
        quartoParams = doc.meta["quarto-params"]:clone()
      end
    end
  }
end

function param(name, default)
  local value = quartoParams[name]
  if value == nil then
    value = default
  end
  return value
end

