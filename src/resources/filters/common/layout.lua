-- layout.lua
-- Copyright (C) 2020 by RStudio, PBC

kLayoutAlign = "layout.align"
kLayoutNcol = "layout.ncol"
kLayoutNrow = "layout.nrow"
kLayout = "layout"

function layoutAlignAttribute(el)
  return attribute(el, "layout.align", "center")
end

function hasLayoutAttributes(el)
  local attribs = tkeys(el.attr.attributes)
  return attribs:includes(kLayoutNrow) or
         attribs:includes(kLayoutNcol) or
         attribs.includes(kLayout)
end