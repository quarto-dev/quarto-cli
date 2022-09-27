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

function makeWrappedFilter(scriptFile, filterHandler)
  local env = setmetatable({}, {__index = shortcodeMetatable(scriptFile)})
  local chunk, err = loadfile(scriptFile, "bt", env)
  local handlers = {}

  function makeSingleHandler(handlerTable)
    local result = {}
    for k,v in pairs(handlerTable) do
      result[k] = {
        file = scriptFile,
        handle = v
      }
    end
    return result
  end

  if not err and chunk then
    local result = chunk()
    if result then
      if quarto.utils.table.isarray(result) then
        for i, handlerTable in pairs(result) do
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

end