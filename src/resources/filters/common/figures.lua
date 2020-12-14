-- figures.lua
-- Copyright (C) 2020 by RStudio, PBC

-- constants for figure attributes
kFigAlign = "fig.align"
kFigEnv = "fig.env"
kFigPos = "fig.pos"
kFigScap = "fig.scap"
kFigNcol = "fig.ncol"
kFigNrow = "fig.nrow"
kFigLayout = "fig.layout"
kResizeWidth = "resize.width"
kResizeHeight = "resize.height"

kLinkedFigSentinel = "<!-- linked-figure -->"

-- filter which tags subfigures with their parent identifier and also 
-- converts linked image figures into figure divs. we do this in a separate 
-- pass b/c normal filters go depth first so we can't actually
-- "see" our parent figure during filtering.
function preprocessFigures(strict)

  return {
    Pandoc = function(doc)
      local walkFigures
      walkFigures = function(parentId)
        
        return {
          Div = function(el)
            if qualifyFigureDiv(el, strict) then
              
              if parentId ~= nil then
                el.attr.attributes["figure-parent"] = parentId
              else
                el = pandoc.walk_block(el, walkFigures(el.attr.identifier))
              end
              
              -- provide default caption if need be
              if figureDivCaption(el) == nil then
                el.content:insert(pandoc.Para({}))
              end
            end
            return el
          end,

          Para = function(el)
            return preprocessParaFigure(el, parentId, strict, strict)
          end
        }
      end

      -- walk all blocks in the document
      for i,el in pairs(doc.blocks) do
        local parentId = nil
        if qualifyFigureDiv(el, strict) then
          parentId = el.attr.identifier
          -- provide default caption if need be
          if figureDivCaption(el) == nil then
            el.content:insert(pandoc.Para({}))
          end
        end
        if el.t == "Para" then
          doc.blocks[i] = preprocessParaFigure(el, nil, strict, strict)
        else
          doc.blocks[i] = pandoc.walk_block(el, walkFigures(parentId))
        end
      end
      
      return doc

    end
  }
end

function preprocessParaFigure(el, parentId, captionRequired, labelRequired)
  
  -- if this is a figure paragraph, tag the image inside with any
  -- parent id we have and insert a "fake" caption
  local image = figureFromPara(el, captionRequired)
  if image and isFigureImage(image, captionRequired, labelRequired) then
    image.attr.attributes["figure-parent"] = parentId
    if #image.caption == 0 then
      image.caption:insert(pandoc.Str(""))
    end
    return el
  end
  
  -- if this is a linked figure paragraph, transform to figure-div
  -- and then transfer attributes to the figure-div as appropriate
  local linkedFig = linkedFigureFromPara(el, captionRequired)
  if linkedFig and isFigureImage(linkedFig, captionRequired, labelRequired) then
    
    -- create figure div
    return createLinkedFigureDiv(el, linkedFig, parentId)
    
  end
  
  -- always reflect back input if we didn't hit one of our cases
  return el
  
end

function createLinkedFigureDiv(el, linkedFig, parentId)
  
  -- create figure-div and transfer caption. add the <!-- --> to prevent  
  -- this from ever being recognized in the AST as a linked figure
  local figureContent = el.content:clone()
  figureContent:insert(pandoc.RawInline("markdown", kLinkedFigSentinel))
  local figureDiv = pandoc.Div(pandoc.Para(figureContent))
  local caption = linkedFig.caption:clone()
  figureDiv.content:insert(pandoc.Para(caption))
  linkedFig.caption = {}
  
  -- make sure we have an identifier
  if linkedFig.attr.identifier == "" then
    linkedFig.attr.identifier = anonymousFigId()
  end
  
  -- if we have a parent, then set it and copy width and height to the div
  if parentId ~= nil then
    figureDiv.attr.attributes["figure-parent"] = parentId
    figureDiv.attr.attributes["width"] = linkedFig.attr.attributes["width"]
    figureDiv.attr.attributes["height"] = linkedFig.attr.attributes["height"]
  end
    
  -- transfer id, classes, and any fig. prefixed attribs

  -- transfer identifier and classes
  figureDiv.attr.identifier = linkedFig.attr.identifier
  figureDiv.attr.classes = linkedFig.attr.classes:clone()
  linkedFig.attr.identifier = ""
  tclear(linkedFig.attr.classes)
  
  -- transfer fig. attributes
  for k,v in pairs(linkedFig.attr.attributes) do
    if isFigAttribute(k) then
      figureDiv.attr.attributes[k] = v
    end
  end
  
  -- clear them from source
  local attribs = tkeys(linkedFig.attr.attributes)
  for _,k in ipairs(attribs) do
    if isFigAttribute(k) then
      linkedFig.attr.attributes[k] = v
    end
  end
    
  -- return the div
  return figureDiv
  
end

function isFigAttribute(name)
  return string.find(name, "^fig%.")
end

function anonymousFigId()
  return "fig:anonymous-" .. tostring(math.random(10000000))
end

function alignAttribute(el)
  local default = pandoc.utils.stringify(
    option("align", pandoc.Str("center"))
  )
  local align = attribute(el, kFigAlign, default)
  if align == "default" then
    align = default
  end
  return align
end

-- is this element a subfigure
function isSubfigure(el)
  if el.attr.attributes["figure-parent"] then
    return true
  else
    return false
  end
end

-- is this a Div containing a figure
function isFigureDiv(el, captionRequired)
  if captionRequired == nil then
    captionRequired = true
  end

  if el.t == "Div" and hasFigureLabel(el) then
    return (not captionRequired) or figureDivCaption(el) ~= nil
  else
    return false
  end
end

function qualifyFigureDiv(el, captionRequired)

  -- must be a div
  if el.t ~= "Div" then
    return false
  end
  
  -- check for caption if we need to
  if captionRequired and figureDivCaption(el) == nil then
    return false
  end
  
  -- check for label
  if hasFigureLabel(el) then
    
    return true
    
  -- check for figure layout attributes (synthesize an id in that case)
  else 
    local attribs = { kFigNrow, kFigNcol, kFigLayout }
    for _,name in ipairs(attribs) do
      if el.attr.attributes[name] then
        el.attr.identifier = anonymousFigId()
        return true
      end
    end
  end
  
  return false
  
end

-- is this an image containing a figure
function isFigureImage(el, captionRequired, labelRequired)
  if captionRequired == nil then
    captionRequired = true
  end
  if labelRequired == nil then
    labelRequired = true
  end
  if (not labelRequired) or hasFigureLabel(el) then
    return (not captionRequired) or #el.caption > 0
  else
    return false
  end
end

-- does this element have a figure label?
function hasFigureLabel(el)
  return string.match(el.attr.identifier, "^fig:")
end

function figureDivCaption(el)
  local last = el.content[#el.content]
  if last and last.t == "Para" and #el.content > 1 then
    if not (#last.content == 1 and last.content[1].t == "Image") then
      return last
    else
      return nil
    end
  else
    return nil
  end
end

function figureFromPara(el, captionRequired)
  if captionRequired == nil then
    captionRequired = true
  end
  if #el.content == 1 and el.content[1].t == "Image" then
    local image = el.content[1]
    if not captionRequired or #image.caption > 0 then
      return image
    else
      return nil
    end
  else
    return nil
  end
end

function linkedFigureFromPara(el, captionRequired, allowSentinel)
  if captionRequired == nil then
    captionRequired = true
  end
  if (#el.content == 1) or (allowSentinel and hasLinkedFigureSentinel(el)) then 
    if el.content[1].t == "Link" then
      local link = el.content[1]
      if #link.content == 1 and link.content[1].t == "Image" then
        local image = link.content[1]
        if not captionRequired or #image.caption > 0 then
          return image
        end
      end
    end
  end
  return nil
end

function hasLinkedFigureSentinel(el)
  local hasSentinel = #el.content == 2 and 
                      el.content[2].t == "RawInline" and 
                      el.content[2].text == kLinkedFigSentinel
  return hasSentinel
end

