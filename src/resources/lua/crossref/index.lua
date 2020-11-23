


-- create the crossref index
function indexInit()
  crossref.index = {
    nextOrder = {},
    nextSubfigureOrder = 1,
    entries = {}
  }
end

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


