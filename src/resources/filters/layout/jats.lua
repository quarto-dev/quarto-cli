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

_quarto.ast.add_renderer("PanelLayout", function(layout)
  return _quarto.format.isJatsOutput()
end, function(layout)

  if layout.float == nil then
    fail("don't know how to render a layout without a float")
    return nil
  end

  -- empty options by default
  if not options then
    options = {}
  end
  -- outer panel to contain css and figure panel
  local attr = pandoc.Attr(layout.identifier or "", layout.classes or {}, layout.attributes or {})
  local panel_content = pandoc.Blocks({})
  -- layout
  for i, row in ipairs(layout.layout) do
    
    local aligns = row:map(function(cell) 
      -- get the align
      local align = cell.attributes[kLayoutAlign]
      return layoutTableAlign(align) 
    end)
    local widths = row:map(function(cell) 
      -- propagage percents if they are provided
      local layoutPercent = horizontalLayoutPercent(cell)
      if layoutPercent then
        return layoutPercent / 100
      else
        return 0
      end
    end)

    local cells = pandoc.List()
    for _, cell in ipairs(row) do
      local align = cell.attributes[kLayoutAlign]
      cells:insert(cell)
    end
    
    -- make the table
    local panelTable = pandoc.SimpleTable(
      pandoc.List(), -- caption
      aligns,
      widths,
      pandoc.List(), -- headers
      { cells }
    )
    
    -- add it to the panel
    panel_content:insert(pandoc.utils.from_simple_table(panelTable))
  end
  prepare_caption(layout.float)
  local result = pandoc.Figure(panel_content, {layout.float.caption_long}, attr)

  if layout.preamble then
    return pandoc.Blocks({ layout.preamble, result })
  else
    return result
  end
end)