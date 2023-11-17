-- index.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- initialize the index
function initCrossrefIndex()
     
  -- compute section offsets
  local sectionOffsets = pandoc.List({0,0,0,0,0,0,0})
  local numberOffset = pandoc.List(param("number-offset", {}))
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
    section = sectionOffsets:clone(),
    sectionOffsets = sectionOffsets:clone(),
    numberOffset = sectionOffsets:clone(),
    entries = {},
    headings = pandoc.List()
  }
  
end

-- advance a chapter
function indexNextChapter(index, appendix)
   -- reset nextOrder to 1 for all types if we are in chapters mode
  if crossrefOption("chapters", false) then
    -- reset all of the cross type counters
    for k,v in pairs(crossref.index.nextOrder) do
      crossref.index.nextOrder[k] = 1
    end
  end
  -- if this is an appendix the note the start index
  if appendix == true and crossref.startAppendix == nil then
    crossref.startAppendix = index
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

function indexAddHeading(identifier)
  if identifier ~= nil and identifier ~= '' then
    crossref.index.headings:insert(identifier)
  end
end

-- add an entry to the index
function indexAddEntry(label, parent, order, caption, appendix)
  if caption ~= nil then
    caption = pandoc.List(caption)
  else
    caption = pandoc.List({})
  end
  crossref.index.entries[label] = {
    parent = parent,
    order = order,
    caption = caption,
    appendix = appendix
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
        if isQmdInput() then
          writeKeysIndex(indexFile)
        else
          writeFullIndex(indexFile)
        end   
      end
    end
  }
end

local function index_caption(v)
  if #v.caption > 0 then
    return inlinesToString(quarto.utils.as_inlines(v.caption))
  else
    return ""
  end
end

function writeKeysIndex(indexFile)
  local index = {
    entries = pandoc.List(),
  }
  for k,v in pairs(crossref.index.entries) do
    -- create entry 
    local entry = {
      key = k,
      caption = index_caption(v)
    }
    -- add entry
    index.entries:insert(entry)
  end
 
  -- write the index
  local json = quarto.json.encode(index)
  local file = io.open(indexFile, "w")
  if file then
    file:write(json)
    file:close()
  else
    warn('Error attempting to write crossref index')
  end
end


function writeFullIndex(indexFile)
  -- create an index data structure to serialize for this file 
  local index = {
    entries = pandoc.List(),
    headings = crossref.index.headings:clone()
  }

  -- add options if we have them
  if next(crossref.options) then
    index.options = {}
    for k,v in pairs(crossref.options) do
      if type(v) == "table" then
        if tisarray(v) and pandoc.utils.type(v) ~= "Inlines" then
          index.options[k] = v:map(function(item) return pandoc.utils.stringify(item) end)
        else
          index.options[k] = pandoc.utils.stringify(v)
        end
      else
        index.options[k] = v
      end
    end
  end

  -- write a special entry if this is a multi-file chapter with an id
  local chapterId = crossrefOption("chapter-id")
  
  if chapterId then
    chapterId = pandoc.utils.stringify(chapterId)

     -- chapter heading
    index.headings:insert(chapterId)

    -- chapter entry
    if refType(chapterId) == "sec" and param("number-offset") ~= nil then
      local chapterEntry = {
        key = chapterId,
        parent = nil,
        order = {
          number = 1,
          section = crossref.index.numberOffset
        }
      }
      index.entries:insert(chapterEntry)
    end
  end

  for k,v in pairs(crossref.index.entries) do
    -- create entry 
    local entry = {
      key = k,
      parent = v.parent,
      order = {
        number = v.order.order,
      },
      caption = index_caption(v)
    }
    -- add section if we have one
    if v.order.section ~= nil then
      entry.order.section = v.order.section
    end
    -- add entry
    index.entries:insert(entry)
  end
 
  -- write the index
  local json = quarto.json.encode(index)
  local file = io.open(indexFile, "w")
  if file then
    file:write(json)
    file:close()
  else
    warn('Error attempting to write crossref index')
  end
end