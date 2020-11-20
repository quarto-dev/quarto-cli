


-- create a crossref index
function indexCreate()
  return {
    nextOrder = 1,
    nextSuborder = 1,
    entries = {}
  }
end

-- add an entry to the index
function indexAddEntry(index, label, parent, order, caption)
  index.entries[label] = {
    parent = parent,
    order = order,
    caption = caption
  }
end

-- does our index already contain this element?
function indexHasElement(index, el)
  return index.entries[el.attr.identifier] ~= nil
end


