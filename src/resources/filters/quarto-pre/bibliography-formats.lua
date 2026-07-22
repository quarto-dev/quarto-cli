-- bibliography-formats.lua
-- Copyright (C) 2020-2022 Posit Software, PBC


function bibliography_formats()
  return {
    Pandoc = function(doc)
      if _quarto.format.isBibliographyOutput() then
        doc.meta.references = pandoc.utils.references(doc)
        doc.meta.bibliography = nil
        return doc
      elseif _quarto.format.isTypstOutput() and doc.meta.bibliography ~= nil
        and quarto.doc.cite_method() ~= "citeproc" then
        -- pandoc's Typst writer backslash-escapes any metadata string starting
        -- with a literal dot (jgm/pandoc#11511). Rewriting each bibliography
        -- path as a raw typst inline bypasses that escaping entirely.
        --
        -- Skip this when citeproc is handling citations natively (cite-method
        -- "citeproc", set when the user opts into `citeproc: true` for Typst):
        -- pandoc's own citeproc reads doc.meta.bibliography to load the actual
        -- bib file, so it must stay a plain path string here.
        doc.meta.bibliography = quarto.utils.as_raw_metadata(doc.meta.bibliography)
        return doc
      end
    end
  }
end