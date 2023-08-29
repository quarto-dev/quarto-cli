-- ipynb.lua
-- Copyright (C) 2020-2023 Posit Software, PBC

_quarto.ast.add_renderer("PanelLayout", function(_)
  return _quarto.format.isIpynbOutput() and param("enable-crossref", true)
end, function(layout)
  if layout.float == nil then
    fail_and_ask_for_bug_report("Ipynb format can't render layouts without floats")
    return pandoc.Div({})
  end
  decorate_caption_with_crossref(layout.float)

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

  local result = pandoc.Div({})

  if layout.float.caption_long then
    result.content:insert(pandoc.Para(quarto.utils.as_inlines(layout.float.caption_long) or {}))
  end

  if layout.preamble then
    return pandoc.Blocks({ layout.preamble, result })
  else
    return result
  end
end)

-- this should really be "_quarto.format.isEmbedIpynb()" or something like that..
_quarto.ast.add_renderer("PanelLayout", function(_)
  return _quarto.format.isIpynbOutput() and not param("enable-crossref", true)
end, function(float)
  internal_error()
  return pandoc.Div({})
end)