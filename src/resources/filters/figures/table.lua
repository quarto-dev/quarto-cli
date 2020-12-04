
-- todo: caption
-- todo: test alignments and widths
-- todo: custom div baseline
-- todo: smaller font for subfig figcaption
-- todo: ice the borders that come in by default (layout table)
-- todo: may need to inject the css via header-includes 
--       (so it can be overriddeen by users)
-- todo: test with smaller fig sizes in word

function tablePanel(divEl, subfigures)
  
    -- create panel
  local panel = pandoc.Div({})
  
  -- alignment
  local align = tableAlign(attribute(divEl, "fig-align", "default"))
  
  -- subfigures
  local subfiguresEl = pandoc.Para({})
  for i, row in ipairs(subfigures) do
    
    local aligns = row:map(function() return align end)
    local widths = row:map(function(figEl)
      local layoutPercent = horizontalLayoutPercent(figEl)
      if layoutPercent then
        figEl.attr.attributes["width"] = nil
        return layoutPercent / 100
      else
        return 0
      end
    end)
    
    local figuresRow = pandoc.List:new()
    for _, image in ipairs(row) do
      local cell = pandoc.List:new()
      if image.t == "Image" then
        cell:insert(pandoc.Para(image))
      else
        cell:insert(image)
      end
      figuresRow:insert(cell)
    end
    
    -- make the table
    local figuresTable = pandoc.SimpleTable(
      pandoc.List:new(), -- caption
      aligns,
      widths,
      pandoc.List:new(), -- headers
      { figuresRow }
    )
    
    -- add it to the panel
    panel.content:insert(pandoc.utils.from_simple_table(figuresTable))
  end
  
  -- insert caption
  panel.content:insert(divEl.content[#divEl.content])
  
  -- return panel
  return panel
end

function tableAlign(align)
  if align == "left" then
    return pandoc.AlignLeft
  elseif align == "center" then
    return pandoc.AlignCenter
  elseif align == "right" then
    return pandoc.AlignRight
  else
    return pandoc.AlignDefault
  end
end
