-- shortcodes-handlers.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

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
---@diagnostic disable-next-line: undefined-global
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
    quarto = quarto
  }
end

local handlers = {}

local function read_arg(args, n)
  local arg = args[n or 1]
  local varName
  if arg == nil then
    return nil
  end
  if type(arg) ~= "string" then
    varName = inlinesToString(arg)
  else
    varName = arg
  end
  return varName
end

function initShortcodeHandlers()

  -- user provided handlers
  local shortcodeFiles = pandoc.List(param("shortcodes", {}))
  for _,shortcodeFile in ipairs(shortcodeFiles) do
    local env = setmetatable({}, {__index = shortcodeMetatable(shortcodeFile)})
    _quarto.withScriptFile(shortcodeFile, function()
      local chunk, err = loadfile(shortcodeFile, "bt", env)
      if chunk ~= nil and not err then
        local result = chunk()
        if result then
          for k,v in pairs(result) do
            handlers[k] = {
              file = shortcodeFile,
              handle = v
            }
          end
        else
          for k,v in pairs(env) do
            handlers[k] = {
              file = shortcodeFile,
              handle = v
            }
          end
        end
      else
        fail(err)
      end
    end)
  end

  local function handle_contents(args)
    local data = {
      type = "contents-shortcode",
      payload = {
        id = read_arg(args)
      }
    }
    flags.has_contents_shortcode = true
    return { pandoc.RawInline('quarto-internal', quarto.json.encode(data)) }
  end

  local function handle_brand(args, _kwargs, _meta, _raw_args, context)
    local brand = require("modules/brand/brand")
    local brandCommand = read_arg(args, 1)

    local warn_bad_brand_command = function()
      warn("Unknown brand command " .. brandCommand .. " specified in a brand shortcode.")
      if context == "block" then
        return pandoc.Blocks { pandoc.Strong({pandoc.Str("?brand:" .. table.concat(args, " "))}) }
      elseif context == "inline" then
        return pandoc.Inlines { pandoc.Strong({pandoc.Str("?brand:" .. table.concat(args, " "))}) }
      elseif context == "text" then
        return "?brand:" .. table.concat(args, " ")
      else
        warn("Unknown context for brand shortcode error: " .. context)
        return { }
      end
    end

    if brandCommand == "color" then 
      local color_name = read_arg(args, 2)
      local color_value = brand.get_color(color_name)
      if color_value == nil then
        return warn_bad_brand_command()
      else
        return pandoc.Inlines { pandoc.Str(color_value) }
      end
    end

    if brandCommand == "logo" then
      local logo_name = read_arg(args, 2)
      local logo_value = brand.get_logo(logo_name)
      local entry = { path = nil }

      if type(logo_value) ~= "table" then
        warn("unexpected logo value entry: " .. type(logo_value))
        return warn_bad_brand_command()
      end

      quarto.utils.dump(logo_value)

      -- does this have light/dark variants?
      -- TODO handle light-dark theme switching
      if logo_value.light then
        entry = logo_value.light
      else
        entry = logo_value
      end

      if type(entry.path) ~= "string" then
        warn("unexpected type in logo light entry: " .. type(entry.path))
        return warn_bad_brand_command()
      end

      -- TODO fix alt text handling
      if context == "block" then
        return pandoc.Blocks { pandoc.Image(pandoc.Inlines {}, entry.path) }
      elseif context == "inline" then
        return pandoc.Inlines { pandoc.Image(pandoc.Inlines {}, entry.path) }
      elseif context == "text" then
        return entry.path
      else
        warn("unexpected context for logo shortcode: " .. context)
        return warn_bad_brand_command()
      end
    end

    return warn_bad_brand_command()
  end

  -- built in handlers (these override any user handlers)
  handlers['meta'] = { handle = handleMeta }
  handlers['var'] = { handle = handleVars }
  handlers['env'] = { handle = handleEnv }
  handlers['pagebreak'] = { handle = handlePagebreak }
  handlers['brand'] = { handle = handle_brand }
  handlers['contents'] = { handle = handle_contents }
end

function handlerForShortcode(shortCode)
  return handlers[shortCode.name]
end

-- Implements reading values from envrionment variables
function handleEnv(args)
  if #args > 0 then
    -- the args are the var name
    local varName = read_arg(args)
    local defaultValue = read_arg(args, 2)

    -- read the environment variable
    local envValue = os.getenv(varName) or defaultValue
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
    local varName = read_arg(args)

    -- strip quotes if present
    -- works around the real bug that we don't have
    -- great control over quoting in shortcode params
    -- see https://github.com/quarto-dev/quarto-cli/issues/7882
    if varName:sub(1,1) == '"' and varName:sub(-1) == '"' then
      varName = varName:sub(2,-2)
    elseif varName:sub(1,1) == "'" and varName:sub(-1) == "'" then
      varName = varName:sub(2,-2)
    end

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
    local varName = read_arg(args)
    
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
    elseif pandoc.utils.type(val) == "List" and #val == 1 then
      return processValue(val[1])
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
    context = '\\page',
    typst = '#pagebreak()'
  }

  if FORMAT == 'docx' then
    return pandoc.RawBlock('openxml', pagebreak.ooxml)
  elseif FORMAT:match 'latex' then
    return pandoc.RawBlock('tex', pagebreak.latex)
  elseif FORMAT:match 'odt' then
    return pandoc.RawBlock('opendocument', pagebreak.odt)
  elseif FORMAT == 'typst' then
    return pandoc.RawBlock('typst', pagebreak.typst)
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