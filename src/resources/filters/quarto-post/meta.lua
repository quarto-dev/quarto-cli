-- meta.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- inject metadata
function quartoPostMetaInject()
  return {
    Meta = function(meta)
      metaInjectLatex(meta, function(inject)
        if postState.usingTikz then
          inject(usePackage("tikz"))
        end
      end)
    
      -- don't emit unnecessary metadata
      meta["quarto-filters"] = nil

      return meta
    end
  }
end

