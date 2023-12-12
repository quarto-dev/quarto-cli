-- crossref.lua
-- Copyright (C) 2023 Posit Software, PBC
--
-- common crossref functions/data

function add_crossref(label, type, title)
  if pandoc.utils.type(title) ~= "Blocks" then
    title = quarto.utils.as_blocks(title)
  end
  local order = indexNextOrder(type)
  indexAddEntry(label, nil, order, title)
  return order
end