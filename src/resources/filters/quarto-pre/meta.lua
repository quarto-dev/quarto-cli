-- meta.lua
-- Copyright (C) 2020 by RStudio, PBC

-- inject metadata
function quartoPreMetaInject()
  return {
    Pandoc = function(doc)
      metaInjectLatex(doc, function(inject)
        if preState.usingTikz then
          inject(usePackage("tikz"))
        end
      end)
      return doc
    end
  }
end

