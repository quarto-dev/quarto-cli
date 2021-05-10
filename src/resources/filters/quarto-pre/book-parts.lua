-- book-parts.lua
-- Copyright (C) 2020 by RStudio, PBC

function bookParts() 
  return {
    Div = function(el)
      -- only latex includes explicit book part headings/sections
      if el.attr.classes:includes('quarto-book-part') and not isLatexOutput() then
        return pandoc.Null()
      end
    end
  }
end