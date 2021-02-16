-- meta.lua
-- Copyright (C) 2020 by RStudio, PBC

-- inject metadata
function metaInject()
  return {
    Pandoc = function(doc)
      
      metaInjectHtml(doc, function(inject)
        if postState.codeFoldingCss then
          inject([[
<style type="text/css">
  details {
    margin-bottom: 1em;
  } 
  details[show] {
    margin-bottom: 0;
  }
</style>
]]
          )
        end
      end)
      
      return doc
    end
  }
end

