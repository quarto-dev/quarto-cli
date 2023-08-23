-- table.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

function tablePanel(divEl, layout, caption, options)
  
  -- empty options by default
  if not options then
    options = {}
  end
  -- outer panel to contain css and figure panel
  local divId = divEl.identifier
  if divId == nil then
    divId = ''
  end

  -- create panel
  local panel = pandoc.Div({}, pandoc.Attr(divId))

  -- layout
  for i, row in ipairs(layout) do
    
    local aligns = row:map(function(cell) 
      
      -- get the align
      local align = cell.attr.attributes[kLayoutAlign]
      
      -- in docx tables inherit their parent cell alignment (likely a bug) so 
      -- this alignment will force all columns in embedded tables to follow it.
      -- if the alignment is center this won't make for very nice tables, so
      -- we force it to pandoc.AlignDefault
      if tableFromLayoutCell(cell) and _quarto.format.isDocxOutput() and align == "center" then
        return pandoc.AlignDefault
      else
        return layoutTableAlign(align) 
      end
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
      local align = cell.attr.attributes[kLayoutAlign]
      cells:insert(tableCellContent(cell, align, options))
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
    panel.content:insert(pandoc.utils.from_simple_table(panelTable))
    
    -- add empty text frame (to prevent a para from being inserted btw the rows)
    if i ~= #layout and options.rowBreak then
      panel.content:insert(options.rowBreak())
    end
  end
  
  -- insert caption
  if caption then
    if options.divCaption then
      caption = options.divCaption(caption)
    end
     panel.content:insert(caption)
  end

  -- return panel
  return panel
end


function tableCellContent(cell, align, options)
  
  -- there will be special code if this an image or table
  local image = figureImageFromLayoutCell(cell)
  local tbl = tableFromLayoutCell(cell)
  local isSubRef = hasRefParent(cell) or (image and hasRefParent(image))
 
  if image then
    -- convert layout percent to physical units (if we have a pageWidth)
    -- this ensures that images don't overflow the column as they have
    -- been observed to do in docx
    if options.pageWidth then
      local layoutPercent = horizontalLayoutPercent(cell)
      if layoutPercent then
        local inches = (layoutPercent/100) * options.pageWidth
        image.attr.attributes["width"] = string.format("%2.2f", inches) .. "in"
      end
    end
    
    -- rtf and odt don't write captions in tables so make this explicit
    if #image.caption > 0 and (_quarto.format.isRtfOutput() or _quarto.format.isOdtOutput()) then
      local caption = image.caption:clone()
      tclear(image.caption)
      local captionPara = pandoc.Para(caption)
      if options.divCaption then
        captionPara = options.divCaption(captionPara, align)
      end
      cell.content:insert(captionPara)
    end
    
    -- we've already aligned the image in a table cell so prevent 
    -- extended handling as it would create a nested table cell
    preventExtendedFigure(image)
  end
  
  if hasFigureRef(cell) then
    -- style div caption if there is a custom caption function
    if options.divCaption then
      local divCaption = options.divCaption(refCaptionFromDiv(cell), align)
      cell.content[#cell.content] = divCaption 
    end
    
    -- we've already aligned the figure in a table cell so prevent 
    -- extended handling as it would create a nested table cell
    preventExtendedFigure(cell)
  end
  
  if tbl then
    
   
    if align == "center" then
      
      -- force widths to occupy 100%
      layoutEnsureFullTableWidth(tbl)
      
      -- for docx output we've forced the alignment of this cell to AlignDefault
      -- above (see the comment in tablePanel for rationale). Forcing the 
      -- table to 100$% width (done right above) makes it appear "centered" so
      -- do the same for the caption
      if _quarto.format.isDocxOutput() then
        local caption = pandoc.utils.blocks_to_inlines(tbl.caption.long)
        tclear(tbl.caption.long)
        if tbl.caption.short then
          tclear(tbl.caption.short)
        end
        cell.content:insert(1, options.divCaption(pandoc.Para(caption), align))
      end
    end
    
    -- workaround issue w/ docx nested tables: https://github.com/jgm/pandoc/issues/6983
    if _quarto.format.isDocxOutput() then
      if PANDOC_VERSION < pandoc.types.Version("2.11.3.2") then
        cell.content:insert(options.rowBreak())
      end
    end
  end
 
  return { cell }
  
end


function layoutTableAlign(align)
  if align == "left" then
    return pandoc.AlignLeft
  elseif align == "center" then
    return pandoc.AlignCenter
  elseif align == "right" then
    return pandoc.AlignRight
  end
end

function layoutEnsureFullTableWidth(tbl)
  if not tbl.colspecs:find_if(function(spec) return spec.width ~= nil end) then
    tbl.colspecs = tbl.colspecs:map(function(spec)
      return { spec[1], (1 / #tbl.colspecs) * 0.98 }
    end)
  end
end


