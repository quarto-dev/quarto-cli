-- layout.lua
-- Copyright (C) 2020 by RStudio, PBC

-- required version
PANDOC_VERSION:must_be_at_least '2.11.2'

-- required modules
text = require 'text'

-- global layout state
layout = {}

-- [import]
function import(script)
  local sep = package.config:sub(1,1)
  script = string.gsub(script, "/", sep)
  local path = PANDOC_SCRIPT_FILE:match("(.*" .. sep .. ")")
  dofile(path .. script)
end
import("meta.lua")
import("latex.lua")
import("html.lua")
import("wp.lua")
import("docx.lua")
import("odt.lua")
import("pptx.lua")
import("table.lua")
import("figures.lua")
import("../common/json.lua")
import("../common/pandoc.lua")
import("../common/format.lua")
import("../common/refs.lua")
import("../common/layout.lua")
import("../common/figures.lua")
import("../common/params.lua")
import("../common/meta.lua")
import("../common/table.lua")
import("../common/debug.lua")
-- [/import]

function layout() 
  
  return {
    
    Div = function(el)
      
      if hasLayoutAttributes(el) then
        
        -- handle subfigure layout
        local code, subfigures = layoutSubfigures(el)
        if subfigures then
          if isLatexOutput() then
            subfigures = latexPanel(el, subfigures)
          elseif isHtmlOutput() then
            subfigures = htmlPanel(el, subfigures)
          elseif isDocxOutput() then
            subfigures = tableDocxPanel(el, subfigures)
          elseif isOdtOutput() then
            subfigures = tableOdtPanel(el, subfigures)
          elseif isWordProcessorOutput() then
            subfigures = tableWpPanel(el, subfigures)
          elseif isPowerPointOutput() then
            subfigures = pptxPanel(el, subfigures)
          else
            subfigures = tablePanel(el, subfigures)
          end
          
          -- we have code then wrap the code and subfigues in a div
          if code then
            local div = pandoc.Div(code)
            div.content:insert(subfigures)
            return div
          -- otherwise just return the subfigures
          else
            return subfigures
          end
        
      end
    end,
    
  }
end

function layoutSubfigures(divEl)
   

  -- There are various ways to specify figure layout:
  --
  --  1) Directly in markup using explicit widths and <hr> to 
  --     delimit rows
  --  2) By specifying fig.ncol or fig.nrow. In this case widths can be explicit 
  --     and/or automatically distributed (% widths required for 
  --     mixing explicit and automatic widths)
  --  3) By specifying fig.layout (nested arrays defining explicit
  --     rows and figure widths)
  --
  
  -- collect all the subfigures (bail if there are none)
  local subfigures = collectSubfigures(divEl)
  if not subfigures then
    return nil
  end
  
   -- init code and layout lists
  local code = pandoc.List:new()
  local layout = pandoc.List:new()
  
  -- collect all the code blocks
  pandoc.walk_block(divEl, {
    CodeBlock = function(el)
      code:insert(el)
    end
  })

  -- note any figure layout attributes
  local figRows = tonumber(attribute(divEl, kLayoutNrow, nil))
  local figCols = tonumber(attribute(divEl, kLayoutNcol, nil))
  local figLayout = attribute(divEl, kLayout, nil)
  
  -- if there is figRows but no figCols then compute figCols
  if not figCols and figRows ~= nil then
    figCols = math.ceil(#subfigures / figRows)
  end
  
  -- check for fig.ncol
  if figCols ~= nil then
    for i,fig in ipairs(subfigures) do
      if math.fmod(i-1, figCols) == 0 then
        layout:insert(pandoc.List:new())
      end
      layout[#layout]:insert(fig)
    end
    -- convert width units to percentages
    widthsToPercent(layout, figCols)
    
    -- allocate remaining space
    layoutWidths(layout, figCols)
    
  -- check for fig.layout
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
          anonymousFigId(), 
          { "quarto-figure-spacer" }, 
          { width = text.sub(width, 2, #width) }
        ))
        layout[#layout]:insert(subfig)
      -- normal figure layout
      else
        local subfig = subfigures[subfigIndex]
        if subfig then
          subfigIndex = subfigIndex + 1
          subfig.attr.attributes["width"] = width
          subfig.attr.attributes["height"] = nil
          layout[#layout]:insert(subfig)
        end
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
  
  -- percentage based layouts need to be scaled down so they don't overflow the page 
  layout = layout:map(function(row)
    if canLayoutFigureRow(row) then
      return row:map(function(fig)
        local percentWidth = widthToPercent(attribute(fig, "width", nil))
        if percentWidth then
          percentWidth = round(percentWidth * 0.96,1)
          fig.attr.attributes["width"] = tostring(percentWidth) .. "%"
        end
        return fig
      end)
    else
      return row
    end
  end)  

  -- if code is empty then make it nil
  if #code == 0 then
    code = nil
  end

  -- return the layout
  return code, layout

end

function collectSubfigures(divEl)
  local subfigures = pandoc.List:new()
  pandoc.walk_block(divEl, {
    Div = function(el)
      if hasLayoutParent(el) then
        subfigures:insert(el)
        el.attr.attributes[kRefParent] = nil
      end
    end,
    Para = function(el)
      local image = discoverFigure(el, false)
      if image and hasRefParent(image) then
        subfigures:insert(image)
        image.attr.attributes[kRefParent] = nil
      end
    end
  })
  if #subfigures > 0 then
    return subfigures
  else
    return nil
  end
end


-- parse a fig.layout specification
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
      defaultWidth = 100 -- this value is arbitrary
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



-- chain of filters
return {
  initParams(),
  layout(),
  extendedFigures(),
  metaInject()
}


