-- shortcodes-handlers.lua
-- Copyright (C) 2020 by RStudio, PBC

-- handlers process shortcode into either a list of inlines or into a block
-- their structure is:
-- {
--   type = "inline" | "block"
--     * the inline type will only be called when processing inlines and will be expected to return a list of inlines
--     * the block type will only be called when processing a block that contains a single shortcode and will be expected to
--       return a block which will replace the block that is being processed
--    handle = function(shortCode)
--      * this function should handle the shortcode and return inlines or blocks as appropriate
-- }        
function handlerForShortcode(shortCode, type)
  local handlers = {
    meta = { 
      type = "inline",
      handle = handleMeta 
    },
    var = {
      type = "inline",
      handle = handleVars
    }
  }
  
  local handler = handlers[shortCode.name]
  if handler ~= nil and handler.type == type then
    return handler
  else
    return nil
  end
end

-- Implements reading values from document metadata
-- as {{< meta title >}}
-- or {{< meta key.subkey.subkey >}}
-- This only supports emitting simple types (not arrays or maps)
function handleMeta(shortCode) 
  if #shortCode.args > 0 then
    -- the args are the var name
    local varName = inlinesToString(shortCode.args[1].value)

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
function handleVars(shortCode) 
  if #shortCode.args > 0 then
    
    -- the args are the var name
    local varName = inlinesToString(shortCode.args[1].value)
    
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
    elseif val.t == "MetaInlines" then
      return val
    else
      warn("Unsupported type for key " .. name .. " in a " .. t .. " shortcode.")
      return { pandoc.Strong({pandoc.Str("?invalid " .. t .. " type:" .. name)}) }         
    end
  else 
    return { pandoc.Str( tostring(val) ) }  
  end
end
