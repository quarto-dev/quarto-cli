-- index.lua
-- Copyright (C) 2020 by RStudio, PBC

-- initialize the index
function initIndex()
  return {
    Pandoc = function(doc)
      
      -- compute section offsets
      local sectionOffsets = pandoc.List:new({0,0,0,0,0,0,0})
      local numberOffset = pandoc.List:new(option("number-offset", {})):map(
        function(offset)
          return tonumber(offset[1].text)
        end
      )
      for i=1,#sectionOffsets do
        if i > #numberOffset then
          break
        end
        sectionOffsets[i] = numberOffset[i]
      end
      
      -- initialize index
      crossref.index = {
        nextOrder = {},
        nextSubfigureOrder = 1,
        section = sectionOffsets,
        sectionOffsets = sectionOffsets,
        entries = {}
      }
      return doc
    end
  }
end

-- advance a chapter
function indexNextChapter()
   -- reset nextOrder to 1 for all types if we are in chapters mode
  if option("chapters", false) then
    for k,v in pairs(crossref.index.nextOrder) do
      crossref.index.nextOrder[k] = 1
    end
  end
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
    section = crossref.index.section:clone(),
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
