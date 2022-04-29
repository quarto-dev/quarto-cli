-- shortcodes-handlers.lua
-- Copyright (C) 2020 by RStudio, PBC

-- handlers process shortcode into either a list of inlines or into a list of blocks
   
local handlers = setmetatable({}, {__index=_G})

function initShortcodeHandlers()
  -- user provided handlers
  local shortcodeFiles = pandoc.List(param("shortcodes", {}))
  for _,shortcodeFile in ipairs(shortcodeFiles) do
    local chunk, err = loadfile(shortcodeFile, "bt", handlers)
    if not err then
      local result = chunk()
      if result then
        handlers = setmetatable({}, {__index=_G})
        for k,v in pairs(result) do
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

end

function handlerForShortcode(shortCode)
  return handlers[shortCode.name]
end

-- Implements reading values from envrionment variables
function handleEnv(args)
  if #args > 0 then
    -- the args are the var name
    local varName = inlinesToString(args[1].value)

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
    local varName = inlinesToString(args[1].value)

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
    local varName = inlinesToString(args[1].value)
    
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
