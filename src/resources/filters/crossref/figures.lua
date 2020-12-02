-- figures.lua
-- Copyright (C) 2020 by RStudio, PBC


-- process all figures
function figures()
  return {
    Div = function(el)
      if isFigureDiv(el) then
        local caption = figureDivCaption(el)
        processFigure(el, caption.content)
      end
      return el
    end,

    Para = function(el)
      local image = figureFromPara(el)
      if image and isFigureImage(image) then
        processFigure(image, image.caption)
      end
      return el
    end
  }
end



-- process a figure, re-writing it's caption as necessary and
-- adding it to the global index of figures
function processFigure(el, captionContent)
  -- get label and base caption
  local label = el.attr.identifier
  local caption = captionContent:clone()

  -- determine order, parent, and displayed caption
  local order
  local parent = el.attr.attributes["figure-parent"]
  if (parent) then
    el.attr.attributes["figure-parent"] = nil
    order = {
      section = nil,
      order = crossref.index.nextSubfigureOrder
    }
    crossref.index.nextSubfigureOrder = crossref.index.nextSubfigureOrder + 1
   
    -- if this isn't latex output, then prepend the subfigure number
    if not isLatexOutput() then
      tprepend(captionContent, { pandoc.Str(")"), pandoc.Space() })
      tprepend(captionContent, subfigNumber(order))
      captionContent:insert(1, pandoc.Str("("))
    end
   
  else
    order = indexNextOrder("fig")
    if not isLatexOutput() then
      tprepend(captionContent, figureTitlePrefix(order))
    end
  end

  -- update the index
  indexAddEntry(label, parent, order, caption)
end

-- is this a Div containing a figure
function isFigureDiv(el)
  return el.t == "Div" and hasFigureLabel(el) and (figureDivCaption(el) ~= nil)
end

-- is this an image containing a figure
function isFigureImage(el)
  return hasFigureLabel(el) and #el.caption > 0
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

function figureTitlePrefix(order)
  return titlePrefix("fig", "Figure", order)
end
