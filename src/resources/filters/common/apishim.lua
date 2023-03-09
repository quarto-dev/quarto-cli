-- apishim.lua
-- Copyright (C) 2020-2023 Posit Software, PBC

local _format = require '_format';
_quarto = {
  ast = {
    walk = function(el, filter)
      return el:walk(filter)
    end
  },
  format = _format;
}