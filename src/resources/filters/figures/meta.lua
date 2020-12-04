-- meta.lua
-- Copyright (C) 2020 by RStudio, PBC

-- inject metadata
function metaInject()
  return {
    Pandoc = function(doc)
      metaInjectLatex(doc, function()
        local subFig =
           usePackage("caption") .. "\n" ..
           usePackage("subcaption")
        addHeaderInclude(doc, "tex", subFig)
      end)
      return doc
    end
  }
end

