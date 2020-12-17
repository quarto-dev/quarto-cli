-- layout.lua
-- Copyright (C) 2020 by RStudio, PBC


kLayoutNcol = "layout.ncol"
kLayoutNrow = "layout.nrow"
kLayout = "layout"

function hasLayoutAttributes(el)
  local attribs = tkeys(el.attr.attributes)
  return attribs:includes(kLayoutNrow) or
         attribs:includes(kLayoutNcol) or
         attribs.includes(kLayout)
end