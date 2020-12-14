-- table.lua
-- Copyright (C) 2020 by RStudio, PBC

function tablePanel(divEl, subfigures, options)
  
  -- empty options by default
  if not options then
    options = {}
  end
  
  -- create panel
  local panel = pandoc.Div({})
  
  -- alignment
  local align = alignAttribute(divEl)
  
  -- subfigures
  local subfiguresEl = pandoc.Para({})
  for i, row in ipairs(subfigures) do
    
    local aligns = row:map(function() return tableAlign(align) end)
    local widths = row:map(function(image) 
      -- if we have a page width in inches then we'll be doing 
      -- explicit layout of the contained figures, in that case
      -- return an even width for each column. otherwise, propagage
      -- percents if they are provided
      if options.pageWidth then
        return (1/#row)
      else
        local layoutPercent = horizontalLayoutPercent(image)
        if layoutPercent then
          return layoutPercent / 100
        else
          return 0
        end
      end
    end)

    local figuresRow = pandoc.List:new()
    for _, image in ipairs(row) do
      figuresRow:insert(figureTableCell(image, align, options))
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
    
    -- add empty text frame (to prevent a para from being inserted btw the rows)
    if i ~= #subfigures and options.rowBreak then
      panel.content:insert(options.rowBreak())
    end
  end
  
  -- insert caption
  local divCaption = figureDivCaption(divEl)
  if divCaption and #divCaption.content > 0 then
    if options.divCaption then
      divCaption = options.divCaption(divCaption, align)
    end
     panel.content:insert(divCaption)
  end
  
  -- return panel
  return panel
end


function figureTableCell(image, align, options)
  
  -- convert layout percent to physical units (if we have a pageWidth)
  if options.pageWidth then
    local layoutPercent = horizontalLayoutPercent(image)
    if layoutPercent then
      local inches = (layoutPercent/100) * options.pageWidth
      image.attr.attributes["width"] = string.format("%2.2f", inches) .. "in"
      -- if this is a linked figure then set width on the image as well
      if image.t == "Div" then
        local linkedFig = linkedFigureFromPara(image.content[1], false, true)
        if linkedFig then
          linkedFig.attr.attributes["width"] = image.attr.attributes["width"]
        end
      end
    end
  end
  
  local cell = pandoc.List:new()
  if image.t == "Image" then
    -- rtf doesn't write captions so make this explicit
    if isRtfOutput() then
      local caption = image.caption:clone()
      tclear(image.caption)
      cell:insert(pandoc.Para(image))
      cell:insert(pandoc.Para(caption))
    else
      cell:insert(pandoc.Para(image))
    end
  else
    -- style the caption
    local divCaption = image.content[#image.content]
    if options.divCaption then
      divCaption = options.divCaption(divCaption, align)
    end
    image.content[#image.content] = divCaption
    cell:insert(image)
  end
  
  return cell
  
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
