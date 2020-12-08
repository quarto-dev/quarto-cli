-- docx.lua
-- Copyright (C) 2020 by RStudio, PBC

function docxPanel(divEl, subfigures)
  
  -- magic numbers
  local layoutCols = 20
  local pageWidth = 12240 - 1440 - 1440
  
   -- alignment
  local align = docxAlign(attribute(divEl, "fig-align", "default"))
  
  -- table and functions to append to it
  local docxTable = pandoc.Div({})
  
  -- begin table  
  addRawBlock(docxTable, "<w:tbl>\n")
  
  -- table props
  local tblProps = pandoc.Para({})
  addRawInline(tblProps, "<w:tblPr>\n<w:tblStyle w:val=\"TableGrid\"/>\n")
  addRawInline(tblProps, "<w:tblW w:w=\"" .. tostring(pageWidth) .. "\" w:type=\"dcx\"/>\n")
  addRawInline(tblProps, "<w:tblLayout w:type=\"fixed\"/>\n</w:tblPr>\n")
  docxTable.content:insert(tblProps)
  
  -- table grid
  local layoutColWidth = math.floor(pageWidth / layoutCols)
  local tblGrid = pandoc.Para({})
  addRawInline(tblGrid, "<w:tblGrid>\n")
  for i=1,layoutCols do
    addRawInline(tblGrid, "</w:gridCol w:w=\"" .. tostring(layoutColWidth) .. "\"/>\n")
  end
  addRawInline(tblGrid, "</w:tblGrid>\n")
  docxTable.content:insert(tblGrid)
    
  for i, row in ipairs(subfigures) do
    addRawBlock(docxTable, "<w:tr>")
    for _, subfigure in ipairs(row) do
      docxTable.content:insert(docxSubfigureCell(subfigure, align, pageWidth, layoutCols))
    end
    addRawBlock(docxTable, "</w:tr>")
  end

  -- end table
  addRawBlock(docxTable, "</w:tbl>\n")
  
  -- write table caption 
  local caption = figureDivCaption(divEl)
  if caption and #caption.content > 0 then
    local captionPara = pandoc.Para({})
    writeCaption(captionPara, caption.content, align)
    docxTable.content:insert(captionPara)
  end
  
  -- return table
  return docxTable

end



function docxSubfigureCell(subfigure, align, pageWidth, layoutCols)
   
   -- cell and function for adding to it
   local cell = pandoc.Para({})
   
   -- compute width and span
   
   -- TODO: this should never return nil for docx (and for latex?)
   local layoutPercent = horizontalLayoutPercent(subfigure)
   if layoutPercent then
     subfigure.attr.attributes["width"] = nil
   else
     layoutPercent = 25
   end
   local width = math.floor((layoutPercent/100)*pageWidth)
   local layoutCols = math.floor((layoutPercent/100)*layoutCols)
   
   local cellPrefix = [[
<w:tc>
<w:tcPr>   
]] .. 
      "<w:tcW w:w=\"" .. tostring(width) .. "\" w:type=\"dcx\"/>\n" ..
      "<w:gridSpan w:val=\"" .. tostring(layoutCols) .. "\"/>\n" .. [[
</w:tcPr>
<w:p>
]]

  if align then
    cellPrefix = cellPrefix .. "<w:pPr>" .. "<w:jc w:val=\"" .. align .. "\"/></w:pPr>\n"
  end
  
  addRawInline(cell, cellPrefix)
  
  --  write the figure (behavior varies based on whether this is an img or div
  local captionInlines 
  if subfigure.t == "Image" then
    -- get caption and clear it
    local cellFig = subfigure:clone()
    captionInlines = cellFig.caption:clone()
    tclear(cellFig.caption)
    -- insert image
    cell.content:insert(cellFig)
  else
    -- get caption 
    captionInlines = figureDivCaption(subfigure).content
    -- write blocks
    tappend(cell.content, pandoc.utils.blocks_to_inlines(
      tslice(subfigure.content, 1, #subfigure.content-1),
      { pandoc.LineBreak() }
    ))
  end
  
  -- write end paragraph
  addRawInline(cell,"</w:p>\n")
  
  -- write the caption paragraph if we have a caption
  if #captionInlines > 0 then
    writeCaption(cell, captionInlines, align)
  end
  
  -- write end table cell
  addRawInline(cell, "</w:tc>\n")
  
  -- return the cell
  return cell
end

function addRawBlock(div, openxml) 
  div.content:insert(pandoc.RawBlock("openxml", openxml))
end

function addRawInline(el, openxml)
  el.content:insert(pandoc.RawInline("openxml", openxml))
end 

function writeCaption(para, captionInlines, align)
  addRawInline(para, "<w:p>\n")
  addRawInline(para, "<w:pPr>\n")
  if align then
    addRawInline(para, "<w:jc w:val=\"" .. align .. "\"/>\n")
  end
  addRawInline(para, "<w:pStyle w:val=\"ImageCaption\" />\n")
  addRawInline(para, "</w:pPr>\n")
  tappend(para.content, captionInlines)
  addRawInline(para, "/w:p>\n")
end
