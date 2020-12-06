-- figures.lua
-- Copyright (C) 2020 by RStudio, PBC

-- filter which tags subfigures with their parent identifier and also 
-- converts linked image figures into figure divs. we do this in a separate 
-- pass b/c normal filters go depth first so we can't actually
-- "see" our parent figure during filtering.
function preprocessFigures(subfigureCaptionRequired)

  return {
    Pandoc = function(doc)
      local walkFigures
      walkFigures = function(parentId)
        
        -- caption is required for figures w/o parents and figures w/ parents
        -- if there is no default subfigure caption
        local captionRequired = (parentId == nil) or subfigureCaptionRequired
        
        return {
          Div = function(el)
            if isFigureDiv(el, captionRequired) then
              if parentId ~= nil then
                -- provide default caption if need be
                if figureDivCaption(el) == nil then
                  el.content:insert(pandoc.Para({}))
                end
                el.attr.attributes["figure-parent"] = parentId
              else
                el = pandoc.walk_block(el, walkFigures(el.attr.identifier))
              end
            end
            return el
          end,

          Para = function(el)
            return preprocessParaFigure(el, parentId, subfigureCaptionRequired)
          end
        }
      end

      -- walk all blocks in the document
      for i,el in pairs(doc.blocks) do
        local parentId = nil
        if isFigureDiv(el) then
          parentId = el.attr.identifier
        end
        if el.t == "Para" then
          doc.blocks[i] = preprocessParaFigure(el, nil)
        else
          doc.blocks[i] = pandoc.walk_block(el, walkFigures(parentId))
        end
      end
      return doc

    end
  }
end

function preprocessParaFigure(el, parentId, subfigureCaptionRequired)
  
  -- caption is required for figures w/o parents and figures w/ parents
  -- if there is no default subfigure caption
  local captionRequired = (parentId == nil) or subfigureCaptionRequired
  
  -- if this is a figure paragraph, tag the image inside with any
  -- parent id we have
  local image = figureFromPara(el, captionRequired)
  if image and isFigureImage(image, captionRequired) then
    image.attr.attributes["figure-parent"] = parentId
    if #image.caption == 0 and not captionRequired then
      return createFigureDiv(el, image, parentId)
    else
      return el
    end
  end
  
  -- if this is a linked figure paragraph, transform to figure-div
  -- and then transfer attributes to the figure-div as appropriate
  local linkedFig = linkedFigureFromPara(el, captionRequired)
  if linkedFig and isFigureImage(linkedFig, captionRequired) then
    
    -- create figure div
    return createFigureDiv(el, linkedFig, parentId)
    
  end
  
  -- always reflect back input if we didn't hit one of our cases
  return el
  
end

function createFigureDiv(el, linkedFig, parentId)
  -- create figure-div and transfer caption
  local figureDiv = pandoc.Div(pandoc.Para(el.content))
  local caption = linkedFig.caption:clone()
  figureDiv.content:insert(pandoc.Para(caption))
  linkedFig.caption = {}
  
  -- if we have a parent, then transfer all attributes (as it's a subfigure)
  if parentId ~= nil then
    figureDiv.attr = linkedFig.attr:clone()
    linkedFig.attr = pandoc.Attr()
    figureDiv.attr.attributes["figure-parent"] = parentId
  -- otherwise just transfer id and any fig- prefixed attribs
  else
    figureDiv.attr.identifier = linkedFig.attr.identifier
    linkedFig.attr.identifier = ""
    for k,v in pairs(linkedFig.attr.attributes) do
      if string.find(k, "^fig%-") then
        figureDiv.attr.attributes[k] = v
        linkedFig.attr.attributes[k] = nil
      end
    end
  end
  
  -- return the div
  return figureDiv
  
end

function collectSubfigures(divEl)
  if isFigureDiv(divEl) then
    local subfigures = pandoc.List:new()
    pandoc.walk_block(divEl, {
      Div = function(el)
        if isSubfigure(el) then
          subfigures:insert(el)
          el.attr.attributes["figure-parent"] = nil
        end
      end,
      Para = function(el)
        local image = figureFromPara(el)
        if image and isSubfigure(image) then
          subfigures:insert(image)
          image.attr.attributes["figure-parent"] = nil
        end
      end,
      HorizontalRule = function(el)
        subfigures:insert(el)
      end
    })
    if #subfigures > 0 then
      return subfigures
    else
      return nil
    end
  else
    return nil
  end
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
    return not captionRequired or figureDivCaption(el) ~= nil
  else
    return false
  end
end

-- is this an image containing a figure
function isFigureImage(el, captionRequired)
  if captionRequired == nil then
    captionRequired = true
  end
  if hasFigureLabel(el) then
    return not captionRequired or #el.caption > 0
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
    return last
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

function linkedFigureFromPara(el, captionRequired)
  if captionRequired == nil then
    captionRequired = true
  end
  if #el.content == 1 and el.content[1].t == "Link" then
    local link = el.content[1]
    if #link.content == 1 and link.content[1].t == "Image" then
      local image = link.content[1]
      if not captionRequired or #image.caption > 0 then
        return image
      end
    end
  end
  return nil
end

