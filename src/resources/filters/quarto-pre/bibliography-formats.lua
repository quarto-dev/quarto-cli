-- bibliography-formats.lua
-- Copyright (C) 2020-2022 Posit Software, PBC


function bibliographyFormats()
  return {
    Pandoc = function(doc)
      if _quarto.format.isBibliographyOutput() then
        doc.meta.references = pandoc.utils.references(doc)
        doc.meta.bibliography = nil
        return doc
      end
    end
  }
end