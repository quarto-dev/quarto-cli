-- meta.lua
-- Copyright (C) 2020 by RStudio, PBC

-- inject metadata
function quartoPostMetaInject()
  return {
    Meta = function(meta)
      
      metaInjectHtml(meta, function(inject)
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
      
      return meta
    end
  }
end

