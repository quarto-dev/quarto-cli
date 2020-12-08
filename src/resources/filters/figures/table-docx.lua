-- table-docx.lua
-- Copyright (C) 2020 by RStudio, PBC

function tableDocxPanel(divEl, subfigures)
  
  -- metrics
  local pageWidth = 12240 - 1440 - 1440
  local pageWidthInches = pageWidth / 72 / 20
  
  -- create panel
  local panel = pandoc.Div({})
  
  -- alignment
  local align = attribute(divEl, "fig-align", "center")
  
  -- subfigures
  local subfiguresEl = pandoc.Para({})
  for i, row in ipairs(subfigures) do
    
    local aligns = row:map(function() return tableAlign(align) end)
    local widths = row:map(function(image) 
      return (1/#row)
    end)

    local figuresRow = pandoc.List:new()
    for _, image in ipairs(row) do
      
      -- convert layout percent to physical units
      local layoutPercent = horizontalLayoutPercent(image)
      if layoutPercent then
        local inches = (layoutPercent/100) * pageWidthInches
        image.attr.attributes["width"] = string.format("%2.2f", inches) .. "in"
        -- if this is a linked figure then set width on the image as well
        if image.t == "Div" then
          local linkedFig = linkedFigureFromPara(image.content[1], false)
          if linkedFig then
            linkedFig.attr.attributes["width"] = image.attr.attributes["width"]
          end
        end
      end
      
      local cell = pandoc.List:new()
      if image.t == "Image" then
        cell:insert(pandoc.Para(image))
      else
        -- style the caption
        image.content[#image.content] = docxPanelCaption(
          image.content[#image.content], align
        )
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
    
    -- add empty block if this isn't the last row (to prevent a paragraph
    -- from being inserted between the tables)
    if i ~= #subfigures then
      panel.content:insert(pandoc.RawBlock("openxml", ""))
    end
  end
  
  -- insert caption
  local divCaption = figureDivCaption(divEl)
  if divCaption and #divCaption.content > 0 then
    panel.content:insert(docxPanelCaption(divCaption, align))
  end
  
  -- return panel
  return panel
end

-- create a native docx caption (note that because "openxml" raw blocks
-- are parsed we need to provide a complete xml node, this implies that
-- we need to stringify the captionEl, losing any markdown therein)
function docxPanelCaption(captionEl, align)
  local caption = 
    "<w:p>\n" ..
      "<w:pPr>\n"
  local captionAlign = docxAlign(align)
  if captionAlign then
    caption = caption .. 
        "<w:jc w:val=\"" .. captionAlign .. "\"/>\n"
  end  
  caption = caption ..
        "<w:spacing w:before=\"200\" />\n" ..
        "<w:pStyle w:val=\"ImageCaption\" />\n" ..
      "</w:pPr>\n"
  caption = caption ..
      "<w:r>\n" ..
        "<w:t xml:space=\"preserve\">" ..
         pandoc.utils.stringify(captionEl) .. 
        "</w:t>\n" ..
      "</w:r>"
  caption = caption ..
    "</w:p>\n"
    
  return pandoc.RawBlock("openxml", caption)
end

function docxAlign(align)
  if align == "left" then
    return "start"
  elseif align == "center" then
    return "center"
  elseif align == "right" then
    return "end"
  else
    return nil
  end
end






