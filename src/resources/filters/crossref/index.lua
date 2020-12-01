-- index.lua
-- Copyright (C) 2020 by RStudio, PBC

-- initialize the index
function initIndex()
  return {
    Pandoc = function(doc)
      crossref.index = {
        nextOrder = {},
        nextSubfigureOrder = 1,
        currentChapter = nil,
        entries = {}
      }
      if option("chapters", false) then
        crossref.index.currentChapter = 0
      end
      return doc
    end
  }
end

-- advance a chapter
function indexNextChapter()
  if option("chapters", false) then
    -- bump current chapter
    crossref.index.currentChapter = crossref.index.currentChapter + 1
    
    -- reset nextOrder to 1 for all types
    for k,v in pairs(crossref.index.nextOrder) do
      crossref.index.nextOrder[k] = 1
    end
  end
  return crossref.index.currentChapter
end

-- next sequence in index for type
function indexNextOrder(type)
  if not crossref.index.nextOrder[type] then
    crossref.index.nextOrder[type] = 1
  end
  local nextOrder = crossref.index.nextOrder[type]
  crossref.index.nextOrder[type] = crossref.index.nextOrder[type] + 1
  crossref.index.nextSubfigureOrder = 1
  return {
    chapter = crossref.index.currentChapter,
    order = nextOrder
  }
end

-- add an entry to the index
function indexAddEntry(label, parent, order, caption)
  if caption ~= nil then
    caption = pandoc.List:new(caption)
  end
  crossref.index.entries[label] = {
    parent = parent,
    order = order,
    caption = caption,
  }
end

-- does our index already contain this element?
function indexHasElement(el)
  return crossref.index.entries[el.attr.identifier] ~= nil
end
