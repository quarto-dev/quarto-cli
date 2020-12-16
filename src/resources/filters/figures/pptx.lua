-- pptx.lua
-- Copyright (C) 2020 by RStudio, PBC


function pptxPanel(divEl, subfigures)
  
  -- create panel
  local panel = pandoc.Div({}, pandoc.Attr(divEl.attr.identifier, {"columns"}))
  
  -- add a column for each figure (max 2 columns will be displayed)
  local kMaxCols = 2
  for i, row in ipairs(subfigures) do
    for _, image in ipairs(row) do
      -- breadk on kMaxCols
      if #panel.content == kMaxCols then
        break
      end
      
      -- get width as percent (propagate to div as a percentage)
      -- (note that PowerPoint currently ignores with but other slide formats
      -- don't so we include it in case this comes online in the future)
      local attributes = {}
      local widthPercent = widthToPercent(attribute(image, "width", nil))
      if widthPercent then
        attributes["width"] = tostring(widthPercent) .. "%"
      end
      image.attr.attributes["width"] = nil
      
      if image.t == "Image" then
        local column = pandoc.Div(
          pandoc.Para(image), 
          pandoc.Attr("", {"column"}, attributes)
        )
        panel.content:insert(column)
      elseif image.t == "Div" then
        image.attr = pandoc.Attr("", {"column"}, attributes)
        panel.content:insert(image)
      end
    end
  end
  
  -- return panel
  return panel
end

