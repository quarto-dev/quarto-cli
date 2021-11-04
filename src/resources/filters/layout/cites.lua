-- columns.lua
-- Copyright (C) 2021 by RStudio, PBC



function cites() 
  return {
    Inlines = function(inlines)  
      local referenceLocation = param('reference-location', 'document')
      local modified = false
      if isLatexOutput() and referenceLocation == 'gutter'  then
        for i,inline in ipairs(inlines) do
          if inline.t == 'Cite' then
            local raw = pandoc.RawInline('latex', '\\marginpar{\\begin{footnotesize}{?quarto-cite:'.. inline.citations[1].id .. '}\\vspace{.1in}\\end{footnotesize}}')
            inlines:insert(i+1, raw)
            modified = true
          end
        end
      end
      if modified then
        return inlines  
      end    
    end,
  }
end
