-- bibliography.lua
-- Copyright (C) 2020-2023 Posit, PBC

function bibliography() 
  return {
    Div = function(el)
      local citeMethod = param('cite-method', 'citeproc')
      if _quarto.format.isLatexOutput() and el.attr.identifier == "refs" and citeMethod ~= 'citeproc' then
        return pandoc.RawBlock("latex", '%bib-loc-124C8010')
      end
    end
  }
end
