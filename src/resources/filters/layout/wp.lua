-- wp.lua
-- Copyright (C) 2020 by RStudio, PBC


function tableWpPanel(divEl, layout, caption)
  return tablePanel(divEl, layout, caption, {
    pageWidth = wpPageWidth()
  })
end


function wpFigure(image)
  
  -- options
  options = {
    pageWidth = wpPageWidth(),
  }
  if isDocxOutput() then
    options.divCaption = docxDivCaption
  elseif isOdtOutput() then
    options.divCaption = odtDivCaption
  end

  -- get alignment
  local align = figAlignAttribute(image)
  
  -- create the row/cell for the figure
  local row = pandoc.List:new()
  local cell = pandoc.Div(pandoc.Para(image))
  transferImageWidthToCell(image, cell)
  row:insert(tableCellContent(cell, align, options))
  
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

function wpPageWidth()
  local width = param("page-width", nil)
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
