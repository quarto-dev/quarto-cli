-- table.lua
-- Copyright (C) 2020 by RStudio, PBC

function tablePanel(divEl, layout, caption, options)
  
  -- empty options by default
  if not options then
    options = {}
  end
  
  -- create panel
  local panel = pandoc.Div({})
  
  -- alignment
  local align = layoutAlignAttribute(divEl)
  
  -- layout
  for i, row in ipairs(layout) do
    
    local aligns = row:map(function() return tableAlign(align) end)
    local widths = row:map(function(cell) 
      -- propagage percents if they are provided
      local layoutPercent = horizontalLayoutPercent(cell)
      if layoutPercent then
        return layoutPercent / 100
      else
        return 0
      end
    end)

    local cells = pandoc.List:new()
    for _, cell in ipairs(row) do
      cells:insert(tableCellContent(cell, align, options))
    end
    
    -- make the table
    local panelTable = pandoc.SimpleTable(
      pandoc.List:new(), -- caption
      aligns,
      widths,
      pandoc.List:new(), -- headers
      { cells }
    )
    
    -- add it to the panel
    panel.content:insert(pandoc.utils.from_simple_table(panelTable))
    
    -- add empty text frame (to prevent a para from being inserted btw the rows)
    if i ~= #layout and options.rowBreak then
      panel.content:insert(options.rowBreak())
    end
  end
  
  -- insert caption
  if caption then
    if options.divCaption then
      divCaption = options.divCaption(divCaption, align)
    end
     panel.content:insert(divCaption)
  end
  
  -- return panel
  return panel
end


function tableCellContent(cell, align, options)
  
  -- there will be special code if this an image
  local image = figureImageFromLayoutCell(cell)
  
  -- for images, convert layout percent to physical units (if we have a 
  -- pageWidth). this ensure that images don't overflow the column as they
  -- have been observed to do in docx
  if image and options.pageWidth then
    local layoutPercent = horizontalLayoutPercent(cell)
    if layoutPercent then
      local inches = (layoutPercent/100) * options.pageWidth
      image.attr.attributes["width"] = string.format("%2.2f", inches) .. "in"
    end
  end
  
  if image then
    -- rtf and odt don't write captions in tables so make this explicit
    if isRtfOutput() or isOdtOutput() then
      local caption = image.caption:clone()
      tclear(image.caption)
      local captionPara = pandoc.Para(caption)
      if options.divCaption then
        captionPara = options.divCaption(captionPara, align)
      end
      cell.content:insert(captionPara)
    end
  -- style div caption if there is a custom caption function
  elseif hasFigureOrTableRef(cell) and options.divCaption then
    local divCaption = options.divCaption(refCaptionFromDiv(cell), align)
    cell.content[#cell.content] = divCaption 
  end
 
  return { cell }
  
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
