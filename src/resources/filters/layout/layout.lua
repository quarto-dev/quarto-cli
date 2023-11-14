-- layout.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- required version
-- PANDOC_VERSION:must_be_at_least '2.13'

-- global layout state
layoutState = {
  hasColumns = false,
}

function layout_panels()

  return {
    Div = function(div)
      if not attr_requires_panel_layout(div.attr) then
        return nil
      end
      local nested_layout = false
      _quarto.ast.walk(div, {
        PanelLayout = function()
          nested_layout = true
        end
      })
      -- if we are nested then we assume the layout
      -- has been handled by the child
      if nested_layout then
        return nil
      end
      local preamble, cells = partition_cells(div)
      local layout = layout_cells(div, cells)
      return quarto.PanelLayout({
        attr = div.attr,
        preamble = preamble,
        layout = layout,
      })
    end,
    FloatRefTarget = function(float)
      local attr = pandoc.Attr(float.identifier, float.classes, float.attributes)
      if not attr_requires_panel_layout(attr) then
        return nil
      end
      local nested_layout = false
      _quarto.ast.walk(div, {
        PanelLayout = function()
          nested_layout = true
        end
      })
      -- if we are nested then we assume the layout
      -- has been handled by the child
      if nested_layout then
        return nil
      end

      local preamble, cells = partition_cells(float)
      local layout = layout_cells(float, cells)
      return quarto.PanelLayout({
        float = float,
        preamble = preamble,
        layout = layout,
      })
    end,
  }  
end

function attr_requires_panel_layout(attr)
  if attr_has_layout_attributes(attr) then
    return true
  end
  return (_quarto.format.isLatexOutput() or _quarto.format.isHtmlOutput()) and
          attr.classes:includes("tbl-parent")
end

function partition_cells(float)
  local preamble = pandoc.List()
  local cells = pandoc.List()

  local heading = nil
  local content = quarto.utils.as_blocks(float.content)
  for _, block in ipairs(content) do    
    if isPreambleBlock(block) then
      if block.t == "CodeBlock" and #preamble > 0 and preamble[#preamble].t == "CodeBlock" then
        preamble[#preamble].text = preamble[#preamble].text .. "\n" .. block.text
      else
        preamble:insert(block)
      end
    elseif block.t == "Header" then
      if _quarto.format.isRevealJsOutput() then
        heading = pandoc.Para({ pandoc.Strong(block.content)})
      else
        heading = block
      end
    else
      local cellDiv = nil
      local subfloat = _quarto.ast.resolve_custom_data(block)

      -- if we were given a scaffolding div like cell-output-display, etc,
      -- we use it.
      if subfloat == nil and is_regular_node(block, "Div") then
        cellDiv = block
      else
        cellDiv = pandoc.Div(block)
      end

      -- -- ensure we are dealing with a div
      -- local cellDiv = nil
      -- if is_regular_node(block, "Div") then
      --   -- if this has a single figure div then unwrap it
      --   if #block.content == 1 and 
      --      is_regular_node(block.content[#block.content], "Div") and
      --      hasFigureOrTableRef(block.content[#block.content]) then
      --     cellDiv = block.content[#block.content]
      --   else
      --     cellDiv = block
      --   end
      -- else
      --   cellDiv = pandoc.Div(block)
      -- end
      
      -- -- special behavior for cells with figures (including ones w/o captions)
      -- local fig = figureImageFromLayoutCell(cellDiv)
      -- if fig then
      --   -- transfer width to cell
      --   transferImageWidthToCell(fig, cellDiv)
      -- end
      if subfloat ~= nil and subfloat.t == "FloatRefTarget" then
        transfer_float_image_width_to_cell(subfloat, cellDiv)
      end
      
      -- if we have a heading then insert it
      if heading then 
        cellDiv.content:insert(1, heading)
        heading = nil
      end


      -- if this is .cell-output-display that isn't a figure or table 
      -- then unroll multiple blocks
      local is_subfloat
      _quarto.ast.walk(cellDiv, {
        FloatRefTarget = function(float)
          is_subfloat = true
          return nil
        end
      })
      if cellDiv.attr.classes:find("cell-output-display") and is_subfloat == nil then
        for _,outputBlock in ipairs(cellDiv.content) do
          if is_regular_node(outputBlock, "Div") then
            cells:insert(outputBlock)
          else
            cells:insert(pandoc.Div(outputBlock))
          end
        end
      else
        -- add the div
        cells:insert(cellDiv)
      end

      -- -- if this is .cell-output-display that isn't a figure or table 
      -- -- then unroll multiple blocks
      -- if cellDiv.attr.classes:find("cell-output-display") and 
      --    #cellDiv.content > 1 and 
      --    not hasFigureOrTableRef(cellDiv) then
      --   for _,outputBlock in ipairs(cellDiv.content) do
      --     if is_regular_node(outputBlock, "Div") then
      --       cells:insert(outputBlock)
      --     else
      --       cells:insert(pandoc.Div(outputBlock))
      --     end
      --   end
      -- else
      --   -- add the div
      --   cells:insert(cellDiv)
      -- end
      
    end
  end

  return preamble, cells
end

function layout_cells(float_or_div, cells)
  
  -- layout to return (list of rows)
  local rows = pandoc.List()
  
  -- note any figure layout attributes
  local layoutRows = tonumber(float_or_div.attributes[kLayoutNrow])
  local layoutCols = tonumber(float_or_div.attributes[kLayoutNcol])
  local layout = float_or_div.attributes[kLayout]
  
  -- default to 1 column if nothing is specified
  if not layoutCols and not layoutRows and not layout then
    layoutCols = 1
  end
  
  -- if there is layoutRows but no layoutCols then compute layoutCols
  if not layoutCols and layoutRows ~= nil then
    layoutCols = math.ceil(#cells / layoutRows)
  end
  
  -- check for cols
  if layoutCols ~= nil then
    for i,cell in ipairs(cells) do
      if math.fmod(i-1, layoutCols) == 0 then
        rows:insert(pandoc.List())
      end
      rows[#rows]:insert(cell)
    end
    -- convert width units to percentages
    widthsToPercent(rows, layoutCols)
    
  -- check for layout
  elseif layout ~= nil then
    -- parse the layout
    layout = parseLayoutWidths(layout, #cells)
    
    -- manage/perform next insertion into the layout
    local cellIndex = 1
    local function layoutNextCell(width)
      -- check for a spacer width (negative percent)
      if isSpacerWidth(width) then
        local cell = pandoc.Div({
          pandoc.Para({pandoc.Str(" ")}),
          pandoc.Para({})
        }, pandoc.Attr(
          "", 
          { "quarto-figure-spacer" }, 
          { width = pandoc.text.sub(width, 2, #width) }
        ))
        rows[#rows]:insert(cell)
      -- normal figure layout
      else
        local cell = cells[cellIndex]
        if cell then
          cellIndex = cellIndex + 1
          cell.attr.attributes["width"] = width
          cell.attr.attributes["height"] = nil
          rows[#rows]:insert(cell)
        end
      end
    end
  
    -- process the layout
    for _,item in ipairs(layout) do
      if cellIndex > #cells then
        break
      end
      rows:insert(pandoc.List())
      for _,width in ipairs(item) do
        layoutNextCell(width)
      end
    end
    
  end
  
  -- determine alignment
  local align = layout_align_attribute(float_or_div)
  
  -- some width and alignment handling
  rows = rows:map(function(row)
    return row:map(function(cell)
      
      -- percentage based layouts need to be scaled down so they don't overflow the page 
      local percentWidth = sizeToPercent(attribute(cell, "width", nil))
      if percentWidth then
        percentWidth = round(percentWidth,1)
        cell.attr.attributes["width"] = tostring(percentWidth) .. "%"
      end
      
      -- provide default alignment if necessary
      cell.attr.attributes[kLayoutAlign] = layoutCellAlignment(cell, align)
     
      -- return cell
      return cell
    end)
   
  end)  

  -- return layout
  return rows
  
end


function requiresPanelLayout(divEl)
  
  if hasLayoutAttributes(divEl) then
    return true
  -- latex and html require special layout markup for subcaptions
  elseif (_quarto.format.isLatexOutput() or _quarto.format.isHtmlOutput()) and 
          divEl.attr.classes:includes("tbl-parent") then
    return true
  else 
    return false
  end
  
end

function isPreambleBlock(el)
  return (el.t == "CodeBlock" and el.attr.classes:includes("cell-code")) or
         (is_regular_node(el, "Div") and el.attr.classes:includes("cell-output-stderr"))
end