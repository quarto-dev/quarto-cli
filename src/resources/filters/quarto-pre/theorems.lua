-- theorems.lua
-- Copyright (C) 2021 by RStudio, PBC


function quartoPreTheorems() 
  
  return {
    Div = function(el)
      if hasTheoremRef(el) then
        local capEl = el.content[1]
        if capEl ~= nil and capEl.t == 'Header' then
          capEl.attr.classes:insert("unnumbered")
          capEl.attr.classes:insert("unlisted")
        end
      end
      return el
    end,
  }
end