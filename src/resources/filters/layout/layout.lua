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
    FloatCrossref = function(float)
      local attr = pandoc.Attr(float.identifier, float.classes, float.attributes)
      if not attr_requires_panel_layout(attr) then
        return nil
      end

      local preamble, cells = partition_cells(float)
      local layout = layout_cells(float, cells)
      
      float.content = pandoc.Div({
        quarto.PanelLayout({
          attributes = float.attributes,
          preamble = preamble,
          cells = cells,
          layout = layout,
        })
      })
      return float
    end,
    -- Div = function(el)
    --   if requiresPanelLayout(el) then
    --     -- partition
    --     local preamble, cells, caption = partitionCells(el)
    --     -- derive layout
    --     local layout = layoutCells(el, cells)
    --     -- call the panel layout functions
    --     local panel
    --     if _quarto.format.isLatexOutput() then
    --       panel = latexPanel(el, layout, caption)
    --     elseif _quarto.format.isHtmlOutput() then
    --       panel = htmlPanel(el, layout, caption)
    --     elseif _quarto.format.isDocxOutput() then
    --       panel = tableDocxPanel(el, layout, caption)
    --     elseif _quarto.format.isOdtOutput() then
    --       panel = tableOdtPanel(el, layout, caption)
    --     elseif _quarto.format.isWordProcessorOutput() then
    --       panel = tableWpPanel(el, layout, caption)
    --     elseif _quarto.format.isPowerPointOutput() then
    --       panel = pptxPanel(el, layout)
    --     else
    --       panel = tablePanel(el, layout, caption)
    --     end
    --     -- transfer attributes from el to panel
    --     local keys = tkeys(el.attr.attributes)
    --     for _,k in pairs(keys) do
    --       if not isLayoutAttribute(k) then
    --         panel.attr.attributes[k] = el.attr.attributes[k]
    --       end
    --     end
        
    --     if #preamble > 0 then
    --       local div = pandoc.Div({})
    --       if #preamble > 0 then
    --         tappend(div.content, preamble)
    --       end
    --       div.content:insert(panel)
    --       return div
          
    --     -- otherwise just return the panel
    --     else
    --       return panel
    --     end
        
    --   end
    -- end
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
  for _, block in ipairs(float.content) do    
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
      if subfloat == nil and block.t == "Div" then
        cellDiv = block
      else
        cellDiv = pandoc.Div(block)
      end

      -- -- ensure we are dealing with a div
      -- local cellDiv = nil
      -- if block.t == "Div" then
      --   -- if this has a single figure div then unwrap it
      --   if #block.content == 1 and 
      --      block.content[#block.content].t == "Div" and
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
      if subfloat ~= nil and subfloat.t == "FloatCrossRef" then
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
        FloatCrossref = function(float)
          is_subfloat = true
          return nil
        end
      })
      if cellDiv.attr.classes:find("cell-output-display") and is_subfloat == nil then
        for _,outputBlock in ipairs(cellDiv.content) do
          if outputBlock.t == "Div" then
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
      --     if outputBlock.t == "Div" then
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

function layout_cells(float, cells)
  
  -- layout to return (list of rows)
  local rows = pandoc.List()
  
  -- note any figure layout attributes
  local layoutRows = tonumber(float.attributes[kLayoutNrow])
  local layoutCols = tonumber(float.attributes[kLayoutNcol])
  local layout = float.attributes[kLayout]
  
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
  local align = layout_align_attribute(float)
  
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

function partitionCells(divEl)
  
  local preamble = pandoc.List()
  local cells = pandoc.List()
  local caption = nil
  
  -- extract caption if it's a table or figure div
  if hasFigureOrTableRef(divEl) then
    caption = refCaptionFromDiv(divEl)
    divEl.content = tslice(divEl.content, 1, #divEl.content-1)
  end
  
  local heading = nil
  for _,block in ipairs(divEl.content) do
    
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
      -- ensure we are dealing with a div
      local cellDiv = nil
      if block.t == "Div" then
        -- if this has a single figure div then unwrap it
        if #block.content == 1 and 
           block.content[#block.content].t == "Div" and
           hasFigureOrTableRef(block.content[#block.content]) then
          cellDiv = block.content[#block.content]
        else
          cellDiv = block
        end
      
      else
        cellDiv = pandoc.Div(block)
      end
      
      -- special behavior for cells with figures (including ones w/o captions)
      local fig = figureImageFromLayoutCell(cellDiv)
      if fig then
        -- transfer width to cell
        transferImageWidthToCell(fig, cellDiv)
      end
      
      -- if we have a heading then insert it
      if heading then 
        cellDiv.content:insert(1, heading)
        heading = nil
      end

      -- if this is .cell-output-display that isn't a figure or table 
      -- then unroll multiple blocks
      if cellDiv.attr.classes:find("cell-output-display") and 
         #cellDiv.content > 1 and 
         not hasFigureOrTableRef(cellDiv) then
        for _,outputBlock in ipairs(cellDiv.content) do
          if outputBlock.t == "Div" then
            cells:insert(outputBlock)
          else
            cells:insert(pandoc.Div(outputBlock))
          end
        end
      else
        -- add the div
        cells:insert(cellDiv)
      end
      
    end
    
  end

  return preamble, cells, caption
  
end


-- function layoutCells(divEl, cells)
  
--   -- layout to return (list of rows)
--   local rows = pandoc.List()
  
--   -- note any figure layout attributes
--   local layoutRows = tonumber(attribute(divEl, kLayoutNrow, nil))
--   local layoutCols = tonumber(attribute(divEl, kLayoutNcol, nil))
--   local layout = attribute(divEl, kLayout, nil)
  
--   -- default to 1 column if nothing is specified
--   if not layoutCols and not layoutRows and not layout then
--     layoutCols = 1
--   end
  
--   -- if there is layoutRows but no layoutCols then compute layoutCols
--   if not layoutCols and layoutRows ~= nil then
--     layoutCols = math.ceil(#cells / layoutRows)
--   end
  
--   -- check for cols
--   if layoutCols ~= nil then
--     for i,cell in ipairs(cells) do
--       if math.fmod(i-1, layoutCols) == 0 then
--         rows:insert(pandoc.List())
--       end
--       rows[#rows]:insert(cell)
--     end
--     -- convert width units to percentages
--     widthsToPercent(rows, layoutCols)
    
--   -- check for layout
--   elseif layout ~= nil then
--     -- parse the layout
--     layout = parseLayoutWidths(layout, #cells)
    
--     -- manage/perform next insertion into the layout
--     local cellIndex = 1
--     local function layoutNextCell(width)
--       -- check for a spacer width (negative percent)
--       if isSpacerWidth(width) then
--         local cell = pandoc.Div({
--           pandoc.Para({pandoc.Str(" ")}),
--           pandoc.Para({})
--         }, pandoc.Attr(
--           "", 
--           { "quarto-figure-spacer" }, 
--           { width = pandoc.text.sub(width, 2, #width) }
--         ))
--         rows[#rows]:insert(cell)
--       -- normal figure layout
--       else
--         local cell = cells[cellIndex]
--         if cell then
--           cellIndex = cellIndex + 1
--           cell.attr.attributes["width"] = width
--           cell.attr.attributes["height"] = nil
--           rows[#rows]:insert(cell)
--         end
--       end
--     end
  
--     -- process the layout
--     for _,item in ipairs(layout) do
--       if cellIndex > #cells then
--         break
--       end
--       rows:insert(pandoc.List())
--       for _,width in ipairs(item) do
--         layoutNextCell(width)
--       end
--     end
    
--   end
  
--   -- determine alignment
--   local align = layoutAlignAttribute(divEl)
  
--   -- some width and alignment handling
--   rows = rows:map(function(row)
--     return row:map(function(cell)
      
--       -- percentage based layouts need to be scaled down so they don't overflow the page 
--       local percentWidth = sizeToPercent(attribute(cell, "width", nil))
--       if percentWidth then
--         percentWidth = round(percentWidth,1)
--         cell.attr.attributes["width"] = tostring(percentWidth) .. "%"
--       end
      
--       -- provide default alignment if necessary
--       cell.attr.attributes[kLayoutAlign] = layoutCellAlignment(cell, align)
     
--       -- return cell
--       return cell
--     end)
   
--   end)  

--   -- return layout
--   return rows
  
-- end

function isPreambleBlock(el)
  return (el.t == "CodeBlock" and el.attr.classes:includes("cell-code")) or
         (el.t == "Div" and el.attr.classes:includes("cell-output-stderr"))
end