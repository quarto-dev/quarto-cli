

-- process all figures, fixing up figure captions as required and
-- and returning an index of all the figures
function processFigures(doc)

  -- figure index (also track figure/subfigure sequences)
  local index = indexCreate()

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
        if isFigureDiv(el) and not indexHasElement(index, el) then
          processFigureDiv(el, parent, index)
          el = pandoc.walk_block(el, walkFigures(el))
          -- update caption of parent if we had subfigures
          appendSubfigureCaptions(el, index)
        end
        return el
      end,

      -- if it's a figure image we haven't seen before then process it
      -- if it carries a caption
      Image = function(el)
        if hasFigureLabel(el) and not indexHasElement(index, el) then
          if #el.caption > 0 then
            local label = el.attr.identifier
            processFigure(label, el.caption, parent, index)
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
      processFigureDiv(el, parent, index)
      parent = el
    end

    -- walk the black
    doc.blocks[i] = pandoc.walk_block(el, walkFigures(parent))

    -- update caption of parent if we had subfigures
    if parent then
       appendSubfigureCaptions(doc.blocks[i], index)
    end
  end

  -- return figure table
  return index.entries
end

-- process a div labeled as a figure (ensures that it has a caption before
-- delegating to processFigure)
function processFigureDiv(el, parent, index)

  -- ensure that there is a trailing paragraph to serve as caption
  local last = el.content[#el.content]
  if not last or last.t ~= "Para" then
    table.insert(last.content, pandoc.Para{pandoc.Str("(Untitled)")})
    last = el.content[#el.content]
  end

  -- process figure
  local label = el.attr.identifier
  processFigure(label, last.content, parent, index)

end

-- process a figure, re-writing it's caption as necessary and
-- adding it to the global index of figures
function processFigure(label, captionEl, parentEl, index)
  -- get base caption
  local caption = pandoc.utils.stringify(captionEl)

  -- determine parent, order, and displayed caption
  local parent = nil
  local order
  if (parentEl) then
    parent = parentEl.attr.identifier
    order = index.nextSuborder
    index.nextSuborder = index.nextSuborder + 1
    -- we have a parent, so clear the table then insert a letter (e.g. 'a')
    tclear(captionEl)
    local letterStr = pandoc.Str(string.char(96 + order))
    table.insert(captionEl, letterStr)
  else
    order = index.nextOrder
    index.nextOrder = index.nextOrder + 1
    index.nextSuborder = 1
    -- insert figure prefix
    table.insert(captionEl, 1, pandoc.Str("Figure " .. order .. ": "))
  end

  -- update the index
  indexAddEntry(index, label, parent, order, caption)
end

-- append any avavilable subfigure captions to the div
function appendSubfigureCaptions(div, index)

  -- look for subfigures
  local subfigures = {}
  for label,figure in pairs(index.entries) do
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
      table.insert(captionEl, pandoc.Str(", "))
    end
    table.insert(captionEl, pandoc.Str(string.char(96 + figure.order)))
    table.insert(captionEl, pandoc.Str(" — "))
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

