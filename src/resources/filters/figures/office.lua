-- office.lua
-- Copyright (C) 2020 by RStudio, PBC


function officeFigure(image)
  
  -- options
  options = {
    pageWidth = officePageWidth(),
  }
  if isDocxOutput() then
    options.divCaption = docxDivCaption
  end

  -- get alignment
  local align = alignAttribute(image, nil)
  
  -- create the row/cell for the figure
  local row = pandoc.List:new()
  row:insert(figureTableCell(image, align, options))
  
  -- make the table
  local figureTable = pandoc.SimpleTable(
    pandoc.List:new(), -- caption
    { tableAlign(align) },         -- alignment
    {   1   },         -- full width
    pandoc.List:new(), -- no headers
    { row }            -- figure
  )
  
  -- return it
  return pandoc.utils.from_simple_table(figureTable)
  
end

function officePageWidth()
  local pageWidth = 12240 - 1440 - 1440
  local pageWidthInches = pageWidth / 72 / 20
  return pageWidthInches
end
