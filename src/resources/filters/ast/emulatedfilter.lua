-- emulatedfilter.lua
-- creates lua filter loaders to support emulated AST
--
-- Copyright (C) 2022 by RStudio, PBC

local function plain_loader(handlers)
  local function wrapFilter(handler)
    local wrappedFilter = {}
    wrappedFilter.scriptFile = handler.scriptFile
    for k, v in pairs(handler) do
      wrappedFilter[k] = v.handle
    end
    return wrappedFilter
  end
  return map_or_call(wrapFilter, handlers)
end

make_wrapped_user_filters = function(filterListName)
  local filters = {}
  for _, v in ipairs(param("quarto-filters")[filterListName]) do
    if (type(v) == "string" and string.match(v, ".lua$") == nil) then
      v = {
        path = v,
        type = "json"
      }
    end
    local wrapped = makeWrappedFilter(v, plain_loader)
    if tisarray(wrapped) then
      for _, innerWrapped in ipairs(wrapped) do
        table.insert(filters, innerWrapped)
      end
    else
      table.insert(filters, wrapped)
    end
  end
  return filters
end