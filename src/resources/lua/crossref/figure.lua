

-- process all figures, fixing up figure captions as required and
-- and returning an index of all the figures
function processFigures(doc)

  -- look for figures in Div and Image elements. Note that both of the
  -- Div and Image handlers verify that they aren't already in the
  -- index before proceeding. This is because the pandoc.walk_block
  -- function will traverse the entire tree, however in the case of
  -- parent figure divs we may have already traversed the subtree
  -- beneath the parent div (and there is no way to stop walk_block
  -- from re-traversing)
  local walkFigures
  walkFigures = function(parent)
    return {

      -- if it's a figure div we haven't seen before then process
      -- it and walk it's children to find subfigures
      Div = function(el)
        if isFigureDiv(el) and not indexHasElement(el) then
          if processFigureDiv(el, parent) then
            el = pandoc.walk_block(el, walkFigures(el))
            -- update caption of parent if we had subfigures
            appendSubfigureCaptions(el)
          end
        end
        return el
      end,

      -- if it's a figure image we haven't seen before then process it
      -- if it carries a caption
      Image = function(el)
        if hasFigureLabel(el) and not indexHasElement(el) then
          if #el.caption > 0 then
            processFigure(el, el.caption, parent)
          end
        end
        return el
      end
    }
  end

  -- walk all blocks in the document
  for i,el in pairs(doc.blocks) do

    -- process any root level figure divs (note parent for
    -- potential subfigure discovery)
    local parent = nil
    if isFigureDiv(el) then
      if processFigureDiv(el, parent) then
        parent = el
      end
    end

    -- walk the black
    doc.blocks[i] = pandoc.walk_block(el, walkFigures(parent))

    -- update caption of parent if we had subfigures
    if parent then
       appendSubfigureCaptions(doc.blocks[i])
    end
  end

end

-- process a div labeled as a figure (ensures that it has a caption before
-- delegating to processFigure)
function processFigureDiv(el, parent)

  -- ensure that there is a trailing paragraph to serve as caption
  local last = el.content[#el.content]
  if last and last.t == "Para" and #el.content > 1 then
    processFigure(el, last.content, parent)
    return true
  else
    return false
  end
end

-- process a figure, re-writing it's caption as necessary and
-- adding it to the global index of figures
function processFigure(el, captionEl, parentEl)
  -- get label and base caption
  local label = el.attr.identifier
  local caption = pandoc.utils.stringify(captionEl)

  -- determine parent, order, and displayed caption
  local parent = nil
  local order
  if (parentEl) then
    parent = parentEl.attr.identifier
    order = crossref.index.nextSuborder
    crossref.index.nextSuborder = crossref.index.nextSuborder + 1
    -- we have a parent, so clear the table then insert a letter (e.g. 'a')
    tclear(captionEl)
    if subfigCaptions() and not tcontains(el.attr.classes, "nocaption") then
      local letterStr = pandoc.Str(subfigNumber(order))
      table.insert(captionEl, letterStr)
    end
  else
    order = crossref.index.nextOrder
    crossref.index.nextOrder = crossref.index.nextOrder + 1
    crossref.index.nextSuborder = 1
    tprepend(captionEl, figureTitlePrefix(order))
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
  local captionEl = div.content[#div.content].content

  -- append to caption in order of insertion
  for label,figure in spairs(subfigures, function(t, a, b) return t[a].order < t[b].order end) do
    if figure.order == 1 then
      table.insert(captionEl, pandoc.Str(". "))
    else
      tappend(captionEl, ccsDelim())
    end

    table.insert(captionEl, pandoc.Str(subfigNumber(figure.order)))
    tappend(captionEl, ccsLabelSep())
    table.insert(captionEl, pandoc.Str(figure.caption))
  end
end

-- is this a Div containing a figure
function isFigureDiv(el)
  return el.t == "Div" and hasFigureLabel(el)
end

-- does this element have a figure label?
function hasFigureLabel(el)
  return string.match(el.attr.identifier, "^fig:")
end


function figureTitlePrefix(num)
  return titlePrefix("fig", "Figure", num)
end

