-- figures.lua
-- Copyright (C) 2020 by RStudio, PBC


function linkedFigures() 
  return {
    Para = function(el)
      local linkedFig = discoverLinkedFigure(el, true)
      if linkedFig then
        return createLinkedFigureDiv(el, linkedFig)
      end
    end
  }
end

function createLinkedFigureDiv(paraEl, linkedFig)
  
  -- create figure div
  local figureDiv = pandoc.Div({})
 
  -- transfer identifier
  figureDiv.attr.identifier = linkedFig.attr.identifier
  linkedFig.attr.identifier = ""
  
  -- transfer classes
  figureDiv.attr.classes = linkedFig.attr.classes:clone()
  tclear(linkedFig.attr.classes)
  
   -- transfer fig. attributes
  for k,v in pairs(linkedFig.attr.attributes) do
    if isFigAttribute(k) then
      figureDiv.attr.attributes[k] = v
    end
  end
  local attribs = tkeys(linkedFig.attr.attributes)
  for _,k in ipairs(attribs) do
    if isFigAttribute(k) then
      linkedFig.attr.attributes[k] = v
    end
  end
    
  --  collect caption
  local caption = linkedFig.caption:clone()
  linkedFig.caption = {}
  
  -- insert the paragraph and a caption paragraph
  figureDiv.content:insert(paraEl)
  figureDiv.content:insert(pandoc.Para(caption))
  
  -- return the div
  return figureDiv
  
end