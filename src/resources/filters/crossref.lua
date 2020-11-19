

function Pandoc(doc)

  figures, doc = processFigures(doc)

  dump(figures)

  return doc
end




function processFigures(doc)

  -- table of figures we will return along with the doc
  local figures = {}

  -- look for figures within divs and images
  local walkBlock
  local walkFigures = {
    Div = walkBlock,
    Image = function(el)
      if hasFigureLabel(el) then
        if #el.caption > 0 then
          processFigure(el.attr.identifier, el.caption, figures)
        end
      end
      return el
    end
  };

  -- check blocks for being figure divs, then process children
  walkBlock = function(el)
    if isFigureDiv(el) then
      el = processFigureDiv(el, figures)
    end
    return pandoc.walk_block(el, walkFigures)
  end

  -- walk all blocks in the document
  for i,el in pairs(doc.blocks) do
    doc.blocks[i] = walkBlock(el)
  end

  -- return figure table and doc
  return figures, doc
end

function isFigureDiv(el)
  return el.t == "Div" and hasFigureLabel(el)
end

function processFigureDiv(el, figures)

  -- ensure that there is a trailing paragraph to serve as caption
  local last = el.content[#el.content]
  if not last or last.t ~= "Para" then
    table.insert(last.content, pandoc.Para{pandoc.Str("(Untitled)")})
    last = el.content[#el.content]
  end

  -- process figure
  processFigure(el.attr.identifier, last.content, figures)

  -- return the modified element
  return el

end

function processFigure(label, caption, figures)
  -- increment index and insert prefix
  local index = #figures + 1
  table.insert(caption, 1, pandoc.Str("Figure " .. index .. ": "))

  -- update the index
  table.insert(figures, {
    index = index,
    label = label,
  })
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


