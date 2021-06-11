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
    metadata = { 
      type = "inline",
      handle = handleMetadata },
  }
  local handler = handlers[shortCode.name]
  if handler ~= nil and handler.type == type then
    return handler
  else
    return nil
  end
end

-- Implements reading values from document metadata
-- as {{< metadata title >}}
-- or {{< metadata key.subkey.subkey >}}
-- This only supports emitting simple types (not arrays or maps)
function handleMetadata(shortCode) 
  if #shortCode.args > 0 then

    -- the args are the var name
    local varName = inlinesToString(shortCode.args[1].value)

    -- read the option value
    local optionValue = option(varName, nil)
    if optionValue ~= nil then
      if type(optionValue) == 'boolean' then
        return { pandoc.Str( tostring(optionValue) ) }      
      elseif type(optionValue) == "table" and optionValue.t == "MetaInlines" then
          return optionValue
      else
        warn("Unsupported metadata type for key " .. varName .. " in a metadata Shortcode.")
        return { pandoc.Strong({pandoc.Str("?invalid metadata type:" .. varName)}) }    
      end
    end
    warn("Unknown metadata key " .. varName .. " specified in a metadata Shortcode.")
    return { pandoc.Strong({pandoc.Str("?metadata:" .. varName)}) }

  end
end