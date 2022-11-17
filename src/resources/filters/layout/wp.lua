-- wp.lua
-- Copyright (C) 2020-2022 Posit Software, PBC


function tableWpPanel(divEl, layout, caption)
  return tablePanel(divEl, layout, caption, {
    pageWidth = wpPageWidth()
  })
end


function wpDivFigure(div)
  
  -- options
  options = {
    pageWidth = wpPageWidth(),
  }

  -- determine divCaption handler (always left-align)
  local divCaption = nil
  if _quarto.format.isDocxOutput() then
    divCaption = docxDivCaption
  elseif _quarto.format.isOdtOutput() then
    divCaption = odtDivCaption
  end
  if divCaption then
    options.divCaption = function(el, align) return divCaption(el, "left") end
  end

  -- get alignment
  local align = figAlignAttribute(div)
  
  -- create the row/cell for the figure
  local row = pandoc.List()
  local cell = div:clone()
  transferImageWidthToCell(div, cell)
  row:insert(tableCellContent(cell, align, options))
  
  -- make the table
  local figureTable = pandoc.SimpleTable(
    pandoc.List(), -- caption
    { layoutTableAlign(align) },  
    {   1   },         -- full width
    pandoc.List(), -- no headers
    { row }            -- figure
  )
  
  -- return it
  return pandoc.utils.from_simple_table(figureTable)
  
end

function wpPageWidth()
  local width = param("page-width", nil)
  if width then 
    if (type(width) == 'table') then
      width = tonumber(pandoc.utils.stringify(width))
    end

    if not width then
      error("You must use a number for page-width")
    else
      return width
    end
  else
    return 6.5
  end
end
