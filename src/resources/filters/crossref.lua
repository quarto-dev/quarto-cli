

function Pandoc(doc)

  local figures = processFigures(doc)

  dump(figures)

  return doc
end


-- process all figures, fixing up figure captions as required and
-- and returning an index of all the figures
function processFigures(doc)

  -- figure index (also track figure/subfigure sequences)
  local index = {
    nextOrder = 1,
    nextSuborder = 1,
    entries = {}
  }

  -- look for figures in Div and Image elements. Note that both of the
  -- Div and Image handlers verify that they aren't already in the
  -- index before proceeding. This is because the pandoc.walk_block
  -- function will traverse the entire tree, however in the case of
  -- parent figure divs we may have already traversed the subtree
  -- beneath the parent div (and there is no way to stop walk_block
  -- from re-traversing)
  local walkFigures = function(parent)
    return {

      -- if it's a figure div we haven't seen before then process
      -- it and walk it's children to find subfigures
      Div = function(el)
        if isFigureDiv(el) and not indexHasElement(index, el) then
          processFigureDiv(el, parent, index)
          pandoc.walk_block(el, walkFigures(el))
          -- update caption of parent

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

  end

  -- return figure table
  return index.entries
end

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
    clearTable(captionEl)
    table.insert(captionEl, pandoc.Str(string.char(96 + order)))
  else
    order = index.nextOrder
    index.nextOrder = index.nextOrder + 1
    index.nextSuborder = 1
    -- insert figure prefix
    table.insert(captionEl, 1, pandoc.Str("Figure " .. order .. ": "))
  end

  -- update the index
  index.entries[label] = {
    parent = parent,
    order = order,
    caption = caption
  }

end

function isFigureDiv(el)
  return el.t == "Div" and hasFigureLabel(el)
end

function hasFigureLabel(el)
  return string.match(el.attr.identifier, "^fig:")
end

function indexHasElement(index, el)
  return index.entries[el.attr.identifier] ~= nil
end

function clearTable(t)
  for k,v in pairs(t) do
    t[k] = nil
  end
end

function dump(o)
  if type(o) == 'table' then
    tdump(o)
  else
    print(tostring(o) .. "\n")
  end
end

function tdump (tbl, indent)
  if not indent then indent = 0 end
  for k, v in pairs(tbl) do
    formatting = string.rep("  ", indent) .. k .. ": "
    if type(v) == "table" then
      print(formatting)
      tdump(v, indent+1)
    elseif type(v) == 'boolean' then
      print(formatting .. tostring(v))
    else
      print(formatting .. v)
    end
  end
end


