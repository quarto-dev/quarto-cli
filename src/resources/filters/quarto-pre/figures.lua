-- figures.lua
-- Copyright (C) 2020 by RStudio, PBC


function figures() 
  return {
   
    Div = function(el)
      
      -- propagate fig.cap on figure div to figure caption 
      if hasFigureRef(el) then
        local figCap = attribute(el, kFigCap, nil)
        if figCap ~= nil then
          local caption = pandoc.Para(markdownToInlines(figCap))
          el.content:insert(caption)
          el.attr.attributes[kFigCap] = nil
        end
      end
      return el
      
    end,
    
    -- create figure divs from linked figures
    Para = function(el)
      local linkedFig = discoverLinkedFigure(el, false)
      if linkedFig then
        -- include caption error if there is no caption for fig:foo
        if #linkedFig.caption == 0 then
          linkedFig.caption:insert(noCaption())
        end
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
  
  -- provide anonymous identifier if necessary
  if figureDiv.attr.identifier == "" then
    figureDiv.attr.identifier = anonymousFigId()
  end
  
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

