-- make-extended-filters.lua
-- creates lua filter loaders to support extended AST
-- Copyright (C) 2022 by RStudio, PBC

local function plainLoader(handlers)
  function wrapFilter(handler)
    local wrappedFilter = {}
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
    v = pandoc.utils.stringify(v)
    local wrapped = makeWrappedFilter(v, plainLoader)
    if tisarray(wrapped) then
      for i, innerWrapped in pairs(wrapped) do
        table.insert(filters, innerWrapped)
      end
    else
      table.insert(filters, wrapped)
    end
  end

  -- local filter = {
  --   traverse = "topdown",
  --   Pandoc = function(doc)
  --     for i, v in pairs(filters) do
  --       quarto.utils.dump(v)
  --       doc = doc:walk(v)
  --     end
  --     return doc, false
  --   end  
  -- }
  -- print("extended user filter:")
  -- quarto.utils.dump(filter)
  -- print("inner filters:")
  -- quarto.utils.dump(filters)
  return filters
end