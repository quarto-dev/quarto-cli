-- meta.lua
-- Copyright (C) 2020 by RStudio, PBC

-- inject metadata
function quartoPreMetaInject()
  return {
    Meta = function(meta)
      metaInjectLatex(meta, function(inject)
        if preState.usingTikz then
          inject(usePackage("tikz"))
        end
      end)
      return meta
    end
  }
end

