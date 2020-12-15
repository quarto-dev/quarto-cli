-- office.lua
-- Copyright (C) 2020 by RStudio, PBC


function tableOfficePanel(divEl, sufigures)
  return tablePanel(divEl, sufigures, {
    pageWidth = officePageWidth()
  })
end


function officeFigure(image)
  
  -- options
  options = {
    pageWidth = officePageWidth(),
  }
  if isDocxOutput() then
    options.divCaption = docxDivCaption
  end

  -- get alignment
  local align = alignAttribute(image)
  
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
  local width = option("page-width", nil)
  if width then 
    width = tonumber(pandoc.utils.stringify(width))
    if not width then
      error("You must use a number for page-width")
    else
      return width
    end
  else
    return 6.5
  end
end
