-- wrapped-filter.lua
-- creates wrapped pandoc filters
-- Copyright (C) 2022 by RStudio, PBC

local function shortcodeMetatable(scriptFile) 
  return {
    -- https://www.lua.org/manual/5.3/manual.html#6.1
    assert = assert,
    collectgarbage = collectgarbage,
    dofile = dofile,
    error = error,
    getmetatable = getmetatable,
    ipairs = ipairs,
    load = load,
    loadfile = loadfile,
    next = next,
    pairs = pairs,
    pcall = pcall,
    print = print,
    rawequal = rawequal,
    rawget = rawget,
    rawlen = rawlen,
    rawset = rawset,
    select = select,
    setmetatable = setmetatable,
    tonumber = tonumber,
    tostring = tostring,
    type = type,
    _VERSION = _VERSION,
    xpcall = xpcall,
    coroutine = coroutine,
    require = require,
    package = package,
    string = string,
    utf8 = utf8,
    table = table,
    math = math,
    io = io,
    file = file,
    os = os,
    debug = debug,
    -- https://pandoc.org/lua-filters.html
    FORMAT = FORMAT,
    PANDOC_READER_OPTIONS = PANDOC_READER_OPTIONS,
    PANDOC_WRITER_OPTIONS = PANDOC_WRITER_OPTIONS,
    PANDOC_VERSION = PANDOC_VERSION,
    PANDOC_API_VERSION = PANDOC_API_VERSION,
    PANDOC_SCRIPT_FILE = scriptFile,
    PANDOC_STATE = PANDOC_STATE,
    pandoc = pandoc,
    lpeg = lpeg,
    re = re,
    -- quarto global environment
    json = json,
    -- quarto functions
    quarto = quarto
  }
end

function makeWrappedJsonFilter(scriptFile, filterHandler)
  local handlers = {
    Pandoc = {
      file = scriptFile,
      handle = function(doc)
        local json = pandoc.write(doc, "json")
        path = quarto.utils.resolve_path_relative_to_document(scriptFile)
        local custom_node_map = {}
        local has_custom_nodes = false
        doc = doc:walk({
          RawInline = function(raw)
            local custom_node, t, kind = _quarto.ast.resolve_custom_data(raw)
            if custom_node ~= nil then
              has_custom_nodes = true
              table.insert(custom_node_map, { id = raw.text, tbl = custom_node, t = t, kind = kind })
            end
          end,
          Meta = function(meta)
            if has_custom_nodes then
              meta["quarto-custom-nodes"] = pandoc.MetaList(custom_node_map)
            end
            return meta
          end
        })
        local result = pandoc.utils.run_json_filter(doc, path)
        if has_custom_nodes then
          doc:walk({
            Meta = function(meta)
              _quarto.ast.reset_custom_tbl(meta["quarto-custom-nodes"])
            end
          })
        end

        return result
      end
    }
  }

  if filterHandler ~= nil then
    return filterHandler(handlers)
  else
    local result = {}
    for k,v in pairs(handlers) do
      result[k] = v.handle
    end
    return result
  end    
end

function makeWrappedLuaFilter(scriptFile, filterHandler)
  local working_directory = pandoc.path.directory(scriptFile)
  return _quarto.withScriptFile(scriptFile, function()
    local env = setmetatable({}, {__index = shortcodeMetatable(scriptFile)})
    local chunk, err = loadfile(scriptFile, "bt", env)
    local handlers = {}
  
    local function makeSingleHandler(handlerTable)
      local result = {}
      setmetatable(result, {
        __index = { scriptFile = scriptFile }
      })
      for k,v in pairs(handlerTable) do
        result[k] = {
          file = scriptFile,
          handle = v,
        }
      end
      return result
    end
  
    if not err and chunk then
      local result = chunk()
      if result then
        if quarto.utils.table.isarray(result) then
          for i, handlerTable in ipairs(result) do
            table.insert(handlers, makeSingleHandler(handlerTable))
          end
        else
          handlers = makeSingleHandler(result)
        end
      else
        handlers = makeSingleHandler(env)
      end
  
      if filterHandler ~= nil then
        return filterHandler(handlers)
      else
        result = {}
        for k,v in pairs(handlers) do
          result[k] = v.handle
        end
        return result
      end    
    else
      error(err)
      os.exit(1)
    end
  end)
end

function makeWrappedFilter(scriptFile, filterHandler)
  if type(scriptFile) == "userdata" then
    scriptFile = pandoc.utils.stringify(scriptFile)
  end

  if type(scriptFile) == "string" then
    return makeWrappedLuaFilter(scriptFile, filterHandler)
  elseif type(scriptFile) == "table" then
    local path = scriptFile.path
    local type = scriptFile.type

    if type == "json" then
      return makeWrappedJsonFilter(path, filterHandler)  
    else
      return makeWrappedLuaFilter(path, filterHandler)
    end
  end
end

function filterIf(condition, filter)
  return {
    Pandoc = function(doc)
      if condition() then
        return doc:walk(filter)
      end
    end
  }
end

function filterSeq(filters)
  return {
    Pandoc = function(doc)
      local result
      -- TODO handle timing and tracing uniformly through our new filter infra
      for _, filter in ipairs(filters) do
        if filter.filter ~= nil then
          filter = filter.filter
        end
        local r = run_emulated_filter(doc, filter, true)
        if r ~= nil then
          doc = r
          result = r
        end
      end
      return result
    end
  }
end