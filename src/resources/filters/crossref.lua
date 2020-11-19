

function Pandoc(doc)

  figures, doc = processFigures(doc)

  dump(figures)

  return doc
end


-- TODO: track the current parent globally. how do we un-set
-- the parent after we leave it's scope

-- TODO: use the parent to assign subindexes / subfigures

function processFigures(doc)

  -- table of figures we will return along with the doc
  local index = {
    next = 1,
    entries = {}
  }

  -- current parent figure
  local parent = nil

  -- walk all blocks in the document
  for i,el in pairs(doc.blocks) do

    -- process any root level figure divs
    if isFigureDiv(el) then
      parent, el = processFigureDiv(el, parent, index)
    end

    -- walk the document recursively
    doc.blocks[i] = pandoc.walk_block(el, {
      Div = function(el)
        if isFigureDiv(el) then
          parent, el = processFigureDiv(el, parent, index)
        end
        return el
      end,
      Image = function(el)
        if hasFigureLabel(el) then
          if #el.caption > 0 then
            local label = el.attr.identifier
            processFigure(label, el.caption, parent, index)
          end
        end
        return el
      end
    }
  )
  end

  -- return figure table and doc
  return index, doc
end

function isFigureDiv(el)
  return el.t == "Div" and hasFigureLabel(el)
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

  -- return label and the modified element
  return label, el

end

function processFigure(label, caption, parent, index)

  -- insert prefix
  table.insert(caption, 1, pandoc.Str("Figure " .. index.next .. ": "))

  -- update the index
  index.entries[label] = {
    index = index.next
  }
  index.next = index.next + 1



end

function hasFigureLabel(el)
  return string.match(el.attr.identifier, "^fig:")
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


