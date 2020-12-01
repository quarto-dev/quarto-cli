-- figures.lua
-- Copyright (C) 2020 by RStudio, PBC

-- filter which tags subfigures with their parent identifier. we do this
-- in a separate pass b/c normal filters go depth first so we can't actually
-- "see" our parent figure during filtering
function subfigures()

  return {
    Pandoc = function(doc)
      local walkFigures
      walkFigures = function(parentId)
        return {
          Div = function(el)
            if isFigureDiv(el) then
              if parentId ~= nil then
                el.attr.attributes["figure-parent"] = parentId
              else
                el = pandoc.walk_block(el, walkFigures(el.attr.identifier))
              end
            end
            return el
          end,

          Image = function(el)
            if (parentId ~= nil) and hasFigureLabel(el) and (#el.caption > 0)  then
              el.attr.attributes["figure-parent"] = parentId
            end
            return el
          end
        }
      end

      -- walk all blocks in the document
      for i,el in pairs(doc.blocks) do
        local parentId = nil
        if isFigureDiv(el) then
          parentId = el.attr.identifier
        end
        doc.blocks[i] = pandoc.walk_block(el, walkFigures(parentId))
      end
      return doc

    end
  }
end

-- process all figures
function figures()
  return {
    Div = function(el)
      if isFigureDiv(el) then
        local caption = figureDivCaption(el)
        processFigure(el, caption.content)
        appendSubfigureCaptions(el)
      end
      return el
    end,

    Image = function(el)
      if isFigureImage(el) then
        processFigure(el, el.caption)
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
    -- we have a parent, so clear the table then insert a letter (e.g. 'a')
    tclear(captionContent)
    if captionSubfig() and not tcontains(el.attr.classes, "nocaption") then
      tappend(captionContent, subfigNumber(order))
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

-- append any avavilable subfigure captions to the div
function appendSubfigureCaptions(div)

  -- look for subfigures
  local subfigures = {}
  for label,figure in pairs(crossref.index.entries) do
    if (div.attr.identifier == figure.parent) then
      subfigures[label] = figure
    end
  end

  -- get caption element
  local captionContent = div.content[#div.content].content

  -- append to caption in order of insertion
  for label,figure in spairs(subfigures, function(t, a, b) return t[a].order.order < t[b].order.order end) do
    if figure.order.order == 1 then
      table.insert(captionContent, pandoc.Str(". "))
    else
      tappend(captionContent, captionCollectedDelim())
    end

    tappend(captionContent, subfigNumber(figure.order))
    tappend(captionContent, captionCollectedLabelSep())
    tappend(captionContent, figure.caption)
  end
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
