-- meta.lua
-- Copyright (C) 2020 by RStudio, PBC

-- inject metadata
function metaInject()
  return {
    Pandoc = function(doc)
      if isLatexOutput() then
        metaInjectLatex(doc)
      end
      return doc
    end
  }
end

function metaInjectLatex(doc)
  
  
end
