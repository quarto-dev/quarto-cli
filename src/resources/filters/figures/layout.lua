-- layout.lua
-- Copyright (C) 2020 by RStudio, PBC 
 
local kAvailablePercent = 96
 
function layoutSubfigures(divEl)
   
  -- There are various ways to specify figure layout:
  --
  --  1) Directly in markup using explicit widths and <hr> to 
  --     delimit rows
  --  2) By specifying fig-cols. In this case widths can be explicit 
  --     and/or automatically distributed (% widths required for 
  --     mixing explicit and automatic widths)
  --  3) By specifying fig-layout (nested arrays defining explicit
  --     rows and figure widths)
  --
  
  -- collect all the subfigures (bail if there are none)
  local subfigures = collectSubfigures(divEl)
  if not subfigures then
    return nil
  end
  
   -- init layout
  local layout = pandoc.List:new()

  -- note any figure layout attributes
  local figCols = tonumber(attribute(divEl, "fig-cols", nil))
  local figLayout = attribute(divEl, "fig-layout", nil)
  
  -- if there are horizontal rules then use that for layout
  if haveHorizontalRules(subfigures) then
    layout:insert(pandoc.List:new())
    for _,fig in ipairs(subfigures) do
      if fig.t == "HorizontalRule" then
        layout:insert(pandoc.List:new())
      else
        layout[#layout]:insert(fig)
      end
    end
    -- remove empty rows
    layout = layout:filter(function(row) return #row > 0 end)
    -- allocate remaining space
    layoutWidths(layout)
    
  -- check for fig-cols
  elseif figCols ~= nil then
    for i,fig in ipairs(subfigures) do
      if math.fmod(i-1, figCols) == 0 then
        layout:insert(pandoc.List:new())
      end
      layout[#layout]:insert(fig)
    end
    -- allocate remaining space
    layoutWidths(layout, figCols)
    
  -- check for fig-layout
  elseif figLayout ~= nil then
    -- parse the layout
    figLayout = parseFigLayout(figLayout, #subfigures)
    
    -- manage/perform next insertion into the layout
    local subfigIndex = 1
    function layoutNextSubfig(width)
      -- check for a spacer width (negative percent)
      if isSpacerWidth(width) then
        local subfig = pandoc.Div({
          pandoc.Para({pandoc.Str(" ")}),
          pandoc.Para({})
        }, pandoc.Attr(
          randomFigId(), 
          { "quarto-figure-spacer" }, 
          { width = text.sub(width, 2, #width) }
        ))
        layout[#layout]:insert(subfig)
      -- normal figure layout
      else
        local subfig = subfigures[subfigIndex]
        subfigIndex = subfigIndex + 1
        subfig.attr.attributes["width"] = width
        subfig.attr.attributes["height"] = nil
        layout[#layout]:insert(subfig)
      end
    end
  
    -- process the layout
    for _,item in ipairs(figLayout) do
      if subfigIndex > #subfigures then
        break
      end
      layout:insert(pandoc.List:new())
      for _,width in ipairs(item) do
        layoutNextSubfig(width)
      end
    end
    
  -- no layout, single column
  else
    for _,fig in ipairs(subfigures) do
      layout:insert(pandoc.List:new({fig}))
    end
    layoutWidths(layout)
  end

  -- return the layout
  return layout

end

function collectSubfigures(divEl)
  local subfigures = pandoc.List:new()
  pandoc.walk_block(divEl, {
    Div = function(el)
      if isSubfigure(el) then
        subfigures:insert(el)
        el.attr.attributes["figure-parent"] = nil
      end
    end,
    Para = function(el)
      local image = figureFromPara(el, false)
      if image and isSubfigure(image) then
        subfigures:insert(image)
        image.attr.attributes["figure-parent"] = nil
      end
    end,
    HorizontalRule = function(el)
      subfigures:insert(el)
    end
  })
  if #subfigures > 0 then
    return subfigures
  else
    return nil
  end
end


-- parse a fig-layout specification
function parseFigLayout(figLayout, figureCount)
  
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
          width = math.floor((width / numericTotal) * kAvailablePercent)
        elseif width <= 1 then
          width = math.floor(width * kAvailablePercent)
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

-- interpolate any missing widths
function layoutWidths(figLayout, cols)
  for _,row in ipairs(figLayout) do
    if canLayoutFigureRow(row) then
      allocateRowWidths(row, cols)
    end
  end
end


-- find allocated row percentages
function allocateRowWidths(row, cols)
  
  -- determine which figs need allocation and how much is left over to allocate
  local available = kAvailablePercent
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
function canLayoutFigureRow(row)
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
    local percent = string.match(width, "^(%d+)%%$")
    if percent then
      return tonumber(percent)
    end
  end
  return nil
end

function haveHorizontalRules(subfigures)
  if subfigures:find_if(function(fig) return fig.t == "HorizontalRule" end) then
    return true
  else
    return false
  end
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
