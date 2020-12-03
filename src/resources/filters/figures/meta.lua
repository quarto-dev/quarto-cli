-- meta.lua
-- Copyright (C) 2020 by RStudio, PBC

-- inject metadata
function metaInject()
  return {
    Pandoc = function(doc)
      metaInjectLatex(doc, function()
        local subFig =
           usePackage("subfig") .. "\n" ..
           usePackage("caption") .. "\n" ..
           "\\captionsetup[subfloat]{margin=0.5em}"
        addHeaderInclude(doc, "tex", subFig)
      end)
      return doc
    end
  }
end

