-- docx.lua
-- Copyright (C) 2020 by RStudio, PBC

function docxPanel(divEl, subfigures)
  
  -- magic numbers
  local layoutCols = 20
  local pageWidth = 12240 - 1440 - 1440
  
  -- table and functions to append to it
  local docxTable = pandoc.Div({})
  function addBlock(openxml) 
    docxTable.content:insert(pandoc.RawBlock("openxml", openxml))
  end
  function addInline(para, openxml)
    para.content:insert(pandoc.RawInline("openxml", openxml))
  end
  
  -- begin table  
  addBlock("<w:tbl>\n")
  
  -- table props
  local tblProps = pandoc.Para({})
  addInline(tblProps, "<w:tblPr>\n<w:tblStyle w:val=\"TableGrid\"/>\n")
  addInline(tblProps, "<w:tblW w:w=\"" .. tostring(pageWidth) .. "\"" w:type=\"dcx\"/>\n")
  addInline(tblProps, "<w:tblLayout w:type=\"fixed\"/>\n</w:tblPr>\n")
  docxTable.content:insert(tblProps)
  
  -- table grid
  local layoutColWidth = math.floor(pageWidth / layoutCols)
  local tblGrid = pandoc.Para({})
  addInline(tblGrid, "<w:tblGrid>\n")
  for i=1,layoutCols do
    addInline(tblGrid, "</w:gridCol w:w=\"" .. tostring(layoutColWidth) .. "\"/>\n")
  end
  addInline(tblGrid, "</w:tblGrid>\n")
  
  -- end table
  addBlock("</w:tbl>\n")
  
  -- return table
  return docxTable
  
  -- create panel
  local panel = pandoc.Div({})
  
  
  
  
  
  -- alignment
  local align = tableAlign(attribute(divEl, "fig-align", "default"))
  
  -- subfigures
  local subfiguresEl = pandoc.Para({})
  for i, row in ipairs(subfigures) do
    
    local aligns = row:map(function() return align end)
    local widths = row:map(function() return 0 end)
     
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
  local divCaption = figureDivCaption(divEl)
  if divCaption and #divCaption.content > 0 then
    panel.content:insert(divCaption)
  end
  
  -- return panel
  return panel
end
