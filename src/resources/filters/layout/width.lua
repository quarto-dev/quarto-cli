-- width.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- parse a layout specification
function parseLayoutWidths(figLayout, cells)
  local figureCount = #cells
  
  if figLayout == "auto" then
    local sizes = pandoc.List({})
    _quarto.ast.walk(pandoc.Div(cells), {
      Image = function(image)
        print("Found image")
        local mt, contents = pandoc.mediabag.lookup(image.src)
        if mt == nil then
          mt, contents = pandoc.mediabag.fetch(image.src)
        end
        if mt == nil then
          error("Could not find image " .. image.src)
        end
        sizes:insert(pandoc.image.size(contents))
      end
    })
    if #cells ~= #sizes then
      error("Number of found images does not match number of cells; cannot use 'auto' layout")
    end
    if #cells == 0 then
      error("No images found; cannot use 'auto' layout")
    end
    -- create widths such that the first image is 100% and the rest are relative to it
    figLayout = pandoc.List({sizes:map(function(size) 
      return size.width * (sizes[1].height / size.height)
    end)})
    quarto.utils.dump(figLayout)
  else
    -- parse json
    figLayout = pandoc.List(quarto.json.decode(figLayout))
    
    -- if there are no tables then make a table and stick the items in it
    if not figLayout:find_if(function(item) return type(item) == "table" end) then
      figLayout = pandoc.List({figLayout})
    end
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
    local cols = pandoc.List(row)
    
    -- see if we have a total numeric value (no strings)
    local numericTotal = 0
    for i=1,#cols do 
      local width = cols[i]
      if type(width) == "number" then
        numericTotal = numericTotal + math.abs(width)
      else
        numericTotal = 0
        break
      end
    end
    
      
    return cols:map(function(width)
      figureLayoutCount = figureLayoutCount + 1
      if type(width) == "number" then
        if _quarto.format.isTypstOutput() then
          width = tostring(width) .. "fr"
        else
          if numericTotal ~= 0 then
            width = round((width / numericTotal) * 100, 2)
          elseif width <= 1 then
            width = round(width * 100, 2)
          end
          width = tostring(width) .. "%"
        end
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
  return pandoc.text.sub(width, 1, 1) == "-"
end


-- convert widths to percentages
function widthsToPercent(layout, cols)
  
  -- for each row
  for _,row in ipairs(layout) do
    
    -- determine numeric widths (and their total) for the row
    local widths = pandoc.List()
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


-- convert widths to typst fractions
function widthsToFraction(layout, cols)

  -- for each row
  for _,row in ipairs(layout) do

    -- initialize widths with 0 or length string
    -- currently we assume the width unit is appropriate for the output format
    local widths = pandoc.List()
    for _,fig in ipairs(row) do
      widths[#widths+1] = 0
      local width = attribute(fig, "width", nil)
      if width then
        local num = tonumber(width)
        if num then
          width = string.format("%.6f", num / PANDOC_WRITER_OPTIONS.dpi) .. "in"
        end
        widths[#widths] = width
      end
    end

    -- default width
    local defaultWidth = "1fr"
    for i=1,cols do
      if (i > #widths) or widths[i] == 0 then
        widths[i] = defaultWidth
      end
    end
    -- allocate widths
    for i,fig in ipairs(row) do
      fig.attr.attributes["width"] = widths[i]
      fig.attr.attributes["height"] = nil
    end

  end
end


-- elements with a percentage width and no height have a 'layout percent'
-- which means then should be laid out at a higher level in the tree than
-- the individual figure element
function horizontalLayoutPercent(el)
  return sizeToPercent(el.attr.attributes["width"])
end

function transferImageWidthToCell(img, divEl)
  divEl.attr.attributes["width"] = img.attributes["width"]
  if sizeToPercent(attribute(img, "width", nil)) then
    img.attributes["width"] = nil
  end
  img.attributes["height"] = nil
end

function transfer_float_image_width_to_cell(float, div_el)
  local width_attr = float.attributes["width"]
  div_el.attr.attributes["width"] = width_attr
  if sizeToPercent(width_attr) then
    float.attributes["width"] = nil
  end
  float.attributes["height"] = nil
end


