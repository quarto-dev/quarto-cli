-- meta.lua
-- Copyright (C) 2020 by RStudio, PBC

-- inject metadata
function layoutMetaInject()
  return {
    Meta = function(meta)
      
      metaInjectLatex(meta, function(inject)
        inject(
          usePackage("caption") .. "\n" ..
          usePackage("subfig")
        )
        if layoutState.usingTikz then
          inject(usePackage("tikz"))
        end
      end)
        
      return meta
    end
  }
end

