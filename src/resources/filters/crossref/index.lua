-- index.lua
-- Copyright (C) 2020 by RStudio, PBC

-- initialize the index
function initIndex()
     
  -- compute section offsets
  local sectionOffsets = pandoc.List:new({0,0,0,0,0,0,0})
  local numberOffset = pandoc.List:new(param("number-offset", {}))
  for i=1,#sectionOffsets do
    if i > #numberOffset then
      break
    end
    sectionOffsets[i] = numberOffset[i]
  end
  
  -- initialize index
  crossref.index = {
    nextOrder = {},
    nextSubrefOrder = 1,
    section = sectionOffsets,
    sectionOffsets = sectionOffsets,
    entries = {}
  }
  
end

-- advance a chapter
function indexNextChapter()
   -- reset nextOrder to 1 for all types if we are in chapters mode
  if crossrefOption("chapters", false) then
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
  crossref.index.nextSubrefOrder = 1
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

-- advance a subref
function nextSubrefOrder()
  local order = { section = nil, order = crossref.index.nextSubrefOrder }
  crossref.index.nextSubrefOrder = crossref.index.nextSubrefOrder + 1
  return order
end

-- does our index already contain this element?
function indexHasElement(el)
  return crossref.index.entries[el.attr.identifier] ~= nil
end


-- filter to write the index
function writeIndex()
  return {
    Pandoc = function(doc)
      local indexFile = param("crossref-index-file")
      if indexFile ~= nil then
        -- create an index data structure to serialize for this file 
        local index = {
          entries = pandoc.List:new()
        }
        -- add options if we have them
        if next(crossref.options) then
          index.options = crossref.options
        end
        for k,v in pairs(crossref.index.entries) do
          -- create entry 
          local entry = {
            key = k,
            parent = v.parent,
            order = {
              number = v.order.order,
            }
          }
          -- add section if we have one
          if v.order.section ~= nil then
            entry.order.section = v.order.section
          end
          -- add entry
          index.entries:insert(entry)
        end
       
        -- write the index
        local json = jsonEncode(index)
        local file = io.open(indexFile, "w")
        file:write(json)
        file:close()
        
      end
    end
  }
end
