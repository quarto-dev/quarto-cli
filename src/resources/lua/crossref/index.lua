


-- create the crossref index
function indexInit()
  crossref.index = {
    nextOrder = 1,
    nextSuborder = 1,
    entries = {}
  }
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


