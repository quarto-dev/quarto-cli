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
  local find_index_of_entry_point = function (entry_point)
    return select(2, pandoc.List.find_if(filter_list,
      function (f) return f.name == entry_point end))
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

    -- Use combineFilters to merge user filter with the entry point's filter.
    -- This ensures they run in a single Pandoc traversal, so file_metadata()
    -- can parse metadata comments before user filters access the metadata.
    local entry_point_entry = filter_list[index]
    local filters_to_combine = {}

    -- Start with the entry point's existing filter
    if entry_point_entry.filter then
      table.insert(filters_to_combine, entry_point_entry.filter)
    end

    -- Add user filter(s)
    if is_many_filters then
      for _, f in ipairs(wrapped) do
        table.insert(filters_to_combine, f)
      end
    else
      table.insert(filters_to_combine, wrapped)
    end

    -- Combine into a single filter for one traversal
    entry_point_entry.filter = combineFilters(filters_to_combine)
  end
end
