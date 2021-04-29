-- meta.lua
-- Copyright (C) 2020 by RStudio, PBC

-- inject metadata
function quartoPostMetaInject()
  return {
    Meta = function(meta)
      

      -- injection awesomebox for captions, if needed
      if postState.hasCallouts and isLatexOutput() then
        metaInjectLatex(meta, function(inject)
          inject(
            usePackage("awesomebox")
          )
        end)
      end

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

