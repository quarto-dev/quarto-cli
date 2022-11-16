-- pptx.lua
-- Copyright (C) 2020-2022 Posit Software, PBC


function pptxPanel(divEl, layout)
  
  -- create panel
  local panel = pandoc.Div({}, pandoc.Attr(divEl.attr.identifier, {"columns"}))
  
  -- add a column for each figure (max 2 columns will be displayed)
  local kMaxCols = 2
  for i, row in ipairs(layout) do
    for _, cell in ipairs(row) do
      -- break on kMaxCols
      if #panel.content == kMaxCols then
        break
      end
      
      -- add the column class
      cell.attr.classes:insert("column")
      
      -- add to the panel
      panel.content:insert(cell)
    end
  end
  
  -- return panel
  return panel
end

