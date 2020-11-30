-- index.lua
-- Copyright (C) 2020 by RStudio, PBC

-- next sequence in index for type
function indexNextOrder(type)
  if not crossref.index.nextOrder[type] then
    crossref.index.nextOrder[type] = 1
  end
  local nextOrder = crossref.index.nextOrder[type]
  crossref.index.nextOrder[type] = crossref.index.nextOrder[type] + 1
  crossref.index.nextSubfigureOrder = 1
  return nextOrder
end

-- add an entry to the index
function indexAddEntry(label, parent, order, caption)
  if caption ~= nil then
    caption = pandoc.List:new(caption)
  end
  crossref.index.entries[label] = {
    parent = parent,
    order = order,
    caption = caption
  }
end

-- does our index already contain this element?
function indexHasElement(el)
  return crossref.index.entries[el.attr.identifier] ~= nil
end
