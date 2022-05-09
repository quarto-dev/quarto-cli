-- shortcodes-handlers.lua
-- Copyright (C) 2020 by RStudio, PBC

-- handlers process shortcode into either a list of inlines or into a list of blocks

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
    -- quarto functions
    quarto = {
      utils = {
        dump = dump
      }
    }
  }
end

local handlers = {}

function initShortcodeHandlers()

  -- user provided handlers
  local shortcodeFiles = pandoc.List(param("shortcodes", {}))
  for _,shortcodeFile in ipairs(shortcodeFiles) do
    local env = setmetatable({}, {__index = shortcodeMetatable(shortcodeFile)})
    local chunk, err = loadfile(shortcodeFile, "bt", env)
    if not err then
      local result = chunk()
      if result then
        for k,v in pairs(result) do
          handlers[k] = v
        end
      else
        for k,v in pairs(env) do
          handlers[k] = v
        end
      end
    else
      error(err)
      os.exit(1)
    end
  end


  -- built in handlers (these override any user handlers)
  handlers['meta'] = handleMeta
  handlers['var'] = handleVars
  handlers['env'] = handleEnv
  handlers['pagebreak'] = handlePagebreak
  handlers['tweet'] = handleTweet

end

function handlerForShortcode(shortCode)
  return handlers[shortCode.name]
end


-- Implements reading values from envrionment variables
function handleEnv(args)
  if #args > 0 then
    -- the args are the var name
    local varName = inlinesToString(args[1])

    -- read the environment variable
    local envValue = os.getenv(varName)
    if envValue ~= nil then
      return { pandoc.Str(envValue) }  
    else 
      warn("Unknown variable " .. varName .. " specified in an env Shortcode.")
      return { pandoc.Strong({pandoc.Str("?env:" .. varName)}) } 
    end
  else
    -- no args, we can't do anything
    return nil
  end
end

-- Implements reading values from document metadata
-- as {{< meta title >}}
-- or {{< meta key.subkey.subkey >}}
-- This only supports emitting simple types (not arrays or maps)
function handleMeta(args) 
  if #args > 0 then
    -- the args are the var name
    local varName = inlinesToString(args[1])

    -- read the option value
    local optionValue = option(varName, nil)
    if optionValue ~= nil then
      return processValue(optionValue, varName, "meta")
    else 
      warn("Unknown meta key " .. varName .. " specified in a metadata Shortcode.")
      return { pandoc.Strong({pandoc.Str("?meta:" .. varName)}) } 
    end
  else
    -- no args, we can't do anything
    return nil
  end
end

-- Implements reading variables from quarto vars file
-- as {{< var title >}}
-- or {{< var key.subkey.subkey >}}
-- This only supports emitting simple types (not arrays or maps)
function handleVars(args) 
  if #args > 0 then
    
    -- the args are the var name
    local varName = inlinesToString(args[1])
    
    -- read the option value
    local varValue = var(varName, nil)
    if varValue ~= nil then
      return processValue(varValue, varName, "var")
    else 
      warn("Unknown var " .. varName .. " specified in a var shortcode.")
      return { pandoc.Strong({pandoc.Str("?var:" .. varName)}) } 
    end

  else
    -- no args, we can't do anything
    return nil
  end
end

function processValue(val, name, t)    
  if type(val) == "table" then
    if #val == 0 then
      return { pandoc.Str( "") }
    elseif pandoc.utils.type(val) == "Inlines" then
      return val
    elseif pandoc.utils.type(val) == "Blocks" then
      return pandoc.utils.blocks_to_inlines(val)
    else
      warn("Unsupported type '" .. pandoc.utils.type(val)  .. "' for key " .. name .. " in a " .. t .. " shortcode.")
      return { pandoc.Strong({pandoc.Str("?invalid " .. t .. " type:" .. name)}) }         
    end
  else 
    return { pandoc.Str( tostring(val) ) }  
  end
end


function handlePagebreak()

  local pagebreak = {
    epub = '<p style="page-break-after: always;"> </p>',
    html = '<div style="page-break-after: always;"></div>',
    latex = '\\newpage{}',
    ooxml = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>',
    odt = '<text:p text:style-name="Pagebreak"/>',
    context = '\\page'
  }

  if FORMAT == 'docx' then
    return pandoc.RawBlock('openxml', pagebreak.ooxml)
  elseif FORMAT:match 'latex' then
    return pandoc.RawBlock('tex', pagebreak.latex)
  elseif FORMAT:match 'odt' then
    return pandoc.RawBlock('opendocument', pagebreak.odt)
  elseif FORMAT:match 'html.*' then
    return pandoc.RawBlock('html', pagebreak.html)
  elseif FORMAT:match 'epub' then
    return pandoc.RawBlock('html', pagebreak.epub)
  elseif FORMAT:match 'context' then
    return pandoc.RawBlock('context', pagebreak.context)
  else
    -- fall back to insert a form feed character
    return pandoc.Para{pandoc.Str '\f'}
  end

end

function isempty(s)
  return s == nil or s == ''
end

function build_request(kwargs)
  local id = pandoc.utils.stringify(kwargs["id"])
  local maxwidth = pandoc.utils.stringify(kwargs["maxwidth"])
  local hide_media = pandoc.utils.stringify(kwargs["hide_media"])
  local hide_thread = pandoc.utils.stringify(kwargs["hide_thread"])
  local omit_script = pandoc.utils.stringify(kwargs["omit_script"])
  local align = pandoc.utils.stringify(kwargs["align"])
  local lang = pandoc.utils.stringify(kwargs["lang"])
  local theme = pandoc.utils.stringify(kwargs["theme"])
  local link_color = pandoc.utils.stringify(kwargs["link_color"])
  local widget_type = pandoc.utils.stringify(kwargs["widget_type"])
  local dnt = pandoc.utils.stringify(kwargs["dnt"])

  if isempty(id) then
    error("Must specify id of tweet via `id=TWEET_ID`.")
  end

  -- see https://developer.twitter.com/en/docs/twitter-api/v1/tweets/post-and-engage/api-reference/get-statuses-oembed
  local request = 'https://publish.twitter.com/oembed?url=https://twitter.com/x/status/' .. id

  if isempty(maxwidth) then
    maxwidth = "550"
  end

  request = request .. "&maxwidth=" .. maxwidth

  if isempty(hide_media) then
    hide_media = "false"
  end

  request = request .. "&hide_media=" .. hide_media

  if isempty(hide_thread) then
    hide_thread = "false"
  end

  request = request .. "&hide_thread=" .. hide_thread

  if isempty(omit_script) then
    omit_script = "false"
  end

  request = request .. "&omit_script=" .. omit_script

  if isempty(align) then
    align = "none"
  end

  request = request .. "&align=" .. align

  if isempty(lang) then
    lang = "en"
  end

  request = request .. "&lang=" .. lang

  if isempty(theme) then
    theme = "light"
  end

  request = request .. "&theme=" .. theme

  if not isempty(link_color) then
    request = request .. "&link_color=" .. link_color
  end

  if not isempty(widget_type) then
    request = request .. "&widget_type=" .. widget_type
  end

  if isempty(dnt) then
    dnt = "false"
  end

  request = request .. "&dnt=" .. dnt
  return request
end

function handleTweet(args, kwargs)

  -- this is really only designed for HTML output at the moment, not sure
  -- if we can support other types of output

  request = build_request(kwargs)

  -- possibilities:
  --   1. user has no internet connection
  --   2. requested tweet does not exist
  --   3. tweet info successfully returned from twitter

  local success, mime_type, contents = pcall(pandoc.mediabag.fetch, request)

  if success then 

    if string.find(mime_type, "json") ~= nil then
      -- http request returned json (good) rather than html (bad, 404 error)
      local parsed = jsonDecode(contents)
      return pandoc.RawBlock('html', parsed.html)
    else
      error("Could not find tweet with that tweet id")
    end
  else
    -- in this case mime_type contains error information if you want to use it to debug
    -- print(mime_type)
    error("Could not find contact Twitter to embed tweet. Do you have a working internet connection?")
  end
end
