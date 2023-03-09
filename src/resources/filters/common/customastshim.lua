-- customastshim.lua
-- Copyright (C) 2020-2023 Posit Software, PBC

_quarto = {
  ast = {
    walk = function(el, filter)
      return el:walk(filter)
    end
  }
}