-- make-extended-filters.lua
-- creates lua filter loaders to support extended AST
-- Copyright (C) 2022 by RStudio, PBC

local function plainLoader(handlers)
  function wrapFilter(handler)
    local wrappedFilter = {}
    wrappedFilter.scriptFile = handler.scriptFile
    for k,v in pairs(handler) do
      wrappedFilter[k] = v.handle
    end
    return wrappedFilter
  end
  return mapOrCall(wrapFilter, handlers)
end

makeExtendedUserFilters = function(filterListName)
  local filters = {}
  for i, v in ipairs(param("quarto-filters")[filterListName]) do
    local wrapped = makeWrappedFilter(v, plainLoader)
    if tisarray(wrapped) then
      for i, innerWrapped in pairs(wrapped) do
        table.insert(filters, innerWrapped)
      end
    else
      table.insert(filters, wrapped)
    end
  end
  return filters
end