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

inject_user_filters_at_entry_points = function(filter_list)
  local function find_index_of_entry_point(entry_point)
    for i, filter in ipairs(filter_list) do
      if filter.name == entry_point then
        return i
      end
    end
    return nil
  end
  local entry_point_counts = {}
  for _, v in ipairs(param("quarto-filters").entryPoints) do
    local entry_point = v["at"] -- FIXME entry_point or entryPoint
    if entry_point_counts[entry_point] == nil then
      entry_point_counts[entry_point] = 0
    end
    entry_point_counts[entry_point] = entry_point_counts[entry_point] + 1

    local wrapped = makeWrappedFilter(v, plain_loader)
    local is_many_filters = tisarray(wrapped)

    local index = find_index_of_entry_point(entry_point)
    if index == nil then
      warn("filter entry point " .. entry_point .. " not found in filter list")
      warn("Will use pre-quarto entry point instead")
      index = find_index_of_entry_point("pre-quarto")
      if index == nil then
        internal_error()
        return
      end
    end
    local filter = {
      name = entry_point .. "-user-" .. tostring(entry_point_counts[entry_point]),
    }
    if is_many_filters then
      filter.filters = wrapped
    else
      filter.filter = wrapped
    end
    table.insert(filter_list, index, filter)
  end
end