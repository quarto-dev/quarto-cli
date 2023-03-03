-- jats.lua
-- Copyright (C) 2020-2022 Posit Software, PBC


function jatsDivFigure(divEl)

  -- ensure that only valid elements are permitted
  local filteredEl = _quarto.ast.walk(divEl, {
    Header = function(el)
      return pandoc.Strong(el.content)
    end
  })

  local figure = pandoc.List({})
  local id = filteredEl.attr.identifier
  
  -- append everything before the caption
  local contents = tslice(filteredEl.content, 1, #filteredEl.content - 1)
  
  -- return the figure and caption
  local caption = refCaptionFromDiv(filteredEl)
  if not caption then
    caption = pandoc.Inlines()
  end
  
  -- convert fig-pos to jats position
  local position = jatsPosition(filteredEl)
  local posAttr = ""
  if position then
    posAttr = ' position="' .. position .. '"'
  end
  
  figure:insert(pandoc.RawBlock('jats', '<fig id="' .. id .. '"' .. posAttr .. '>'))
  figure:insert(pandoc.RawBlock('jats', '<caption>'))
  figure:insert(caption);
  figure:insert(pandoc.RawBlock('jats', '</caption>'))
  tappend(figure, contents)
  figure:insert(pandoc.RawBlock('jats', '</fig>'))
  return figure
end

function jatsPosition(el) 
    local figPos = attribute(el, kFigPos, nil)
    if figPos and figPos == 'h' and figPos == 'H' then
      return "anchor"
    else
      return "float"
    end
end
