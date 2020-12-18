-- width.lua
-- Copyright (C) 2020 by RStudio, PBC

-- parse a layout specification
function parseLayoutWidths(figLayout, figureCount)
  
  -- parse json
  figLayout = pandoc.List:new(jsonDecode(figLayout))
  
  -- if there are no tables then make a table and stick the items in it
  if not figLayout:find_if(function(item) return type(item) == "table" end) then
     figLayout = pandoc.List:new({figLayout})
  end
      
  -- validate that layout is now all rows
  if figLayout:find_if(function(item) return type(item) ~= "table" end) then
    error("Invalid figure layout specification " .. 
          "(cannot mix rows and items at the top level")
  end
  
  -- convert numbers to strings as appropriate
  figureLayoutCount = 0
  figLayout = figLayout:map(function(row)
    --- get the cols
    local cols = pandoc.List:new(row)
    
    -- see if we have a total numeric value (no strings)
    local numericTotal = 0
    for i=1,#cols do 
      local width = cols[i]
      if type(width) == "number" then
        numericTotal = numericTotal + math.abs(width)
      else
        numericTotal = nil
        break
      end
    end
    
      
    return cols:map(function(width)
      figureLayoutCount = figureLayoutCount + 1
      if type(width) == "number" then
        if numericTotal ~= nil then
          width = round((width / numericTotal) * 100, 2)
        elseif width <= 1 then
          width = round(width * 100, 2)
        end
        width = tostring(width) .. "%"
      end
      -- negative widths are "spacers" so we need to bump our total fig count
      if isSpacerWidth(width) then
        figureCount = figureCount + 1
      end
      -- return the width
      return width
    end)
  end)
  
  -- if there aren't enough rows then extend using the last row as a template
  local figureGap = figureCount - figureLayoutCount
  if figureGap > 0 then
    local lastRow = figLayout[#figLayout]
    local rowsToAdd = math.ceil(figureGap/#lastRow)
    for i=1,rowsToAdd do
      figLayout:insert(lastRow:clone())
    end
  end
   
  -- return the layout
  return figLayout
  
end

function isSpacerWidth(width)
  return text.sub(width, 1, 1) == "-"
end


-- convert widths to percentages
function widthsToPercent(layout, cols)
  
  -- for each row
  for _,row in ipairs(layout) do
    
    -- determine numeric widths (and their total) for the row
    local widths = pandoc.List:new()
    for _,fig in ipairs(row) do
      widths[#widths+1] = 0
      local width = attribute(fig, "width", nil)
      if width then
        width = tonumber(string.match(width, "^(-?[%d%.]+)"))
        if width then
          widths[#widths] = width
        end
      end
    end
    
    -- create virtual fig widths as needed and note the total width
    local defaultWidth = widths:find_if(function(width) return width > 0 end)
    if defaultWidth == nil then
      defaultWidth = 42 -- this value is arbitrary
    end
    local totalWidth = 0
    for i=1,cols do
      if (i > #widths) or widths[i] == 0 then
        widths[i] = defaultWidth
      end
      totalWidth = totalWidth + widths[i]
    end
    -- allocate widths
    for i,fig in ipairs(row) do
      local width = round((widths[i]/totalWidth) * 100, 1)
      fig.attr.attributes["width"] = 
         tostring(width) .. "%"
      fig.attr.attributes["height"] = nil
    end
    
  end
end


-- interpolate any missing widths
function layoutWidths(rows, cols)
  for _,row in ipairs(rows) do
    if canAllocateRowWidths(row) then
      allocateRowWidths(row, cols)
    end
  end
end


-- find allocated row percentages
function allocateRowWidths(row, cols)
  
  -- determine which figs need allocation and how much is left over to allocate
  local available = 100
  local unallocatedFigs = pandoc.List:new()
  for _,fig in ipairs(row) do
    local width = attribute(fig, "width", nil)
    local percent = widthToPercent(width)
    if percent then
       available = available - percent
    else
      unallocatedFigs:insert(fig)
    end
  end
  
  -- pad to cols
  if cols and #row < cols then
    for i=#row+1,cols do
      unallocatedFigs:insert("nil")
    end
  end
  

  -- do the allocation
  if #unallocatedFigs > 0 then
    -- minimum of 10% allocation
    available = math.max(available, #unallocatedFigs * 10)
    allocation = math.floor(available / #unallocatedFigs)
    for _,fig in ipairs(unallocatedFigs) do
      if fig ~= "nil" then
        fig.attr.attributes["width"] = tostring(allocation) .. "%"
      end
    end
  end

end

-- a non-% width or a height disqualifies the row
function canAllocateRowWidths(row)
  for _,fig in ipairs(row) do
    local width = attribute(fig, "width", nil)
    if width and not widthToPercent(width) then
      return false
    elseif attribute(fig, "height", nil) ~= nil then
      return false
    end
  end
  return true
end

function widthToPercent(width)
  if width then
    local percent = string.match(width, "^([%d%.]+)%%$")
    if percent then
      return tonumber(percent)
    end
  end
  return nil
end


-- elements with a percentage width and no height have a 'layout percent'
-- which means then should be laid out at a higher level in the tree than
-- the individual figure element
function horizontalLayoutPercent(el)
  local percentWidth = widthToPercent(el.attr.attributes["width"])
  if percentWidth and not el.attr.attributes["height"] then
    return percentWidth 
  else
    return nil
  end
end



