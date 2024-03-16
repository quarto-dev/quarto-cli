-- theorems.lua
-- Copyright (C) 2021-2022 Posit Software, PBC


function quarto_pre_theorems() 
  
  return {
    Div = function(el)
      if has_theorem_ref(el) then
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