-- error-filter.lua
-- This filter purposely generates an error for testing error logging

function Pandoc(doc)
  -- Generate an error
  internal_error("This is a deliberate error from error-filter.lua for testing purposes")
  return doc
end
