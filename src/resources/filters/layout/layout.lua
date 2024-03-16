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

  local function is_preamble_block(el)
    return (el.t == "CodeBlock" and el.attr.classes:includes("cell-code")) or
           (is_regular_node(el, "Div") and 
            (el.attr.classes:includes("cell-output-stderr") or
             el.attr.classes:includes("cell-annotation")))
  end

  local function handle_preamble_codeblock(block)
    if block.t == "CodeBlock" and #preamble > 0 and preamble[#preamble].t == "CodeBlock" then
      preamble[#preamble].text = preamble[#preamble].text .. "\n" .. block.text
    else
      preamble:insert(block)
    end
  end

  for _, block in ipairs(content) do
    if is_preamble_block(block) then
      handle_preamble_codeblock(block)
    elseif block.t == "Header" then
      if _quarto.format.isRevealJsOutput() then
        heading = pandoc.Para({ pandoc.Strong(block.content)})
      else
        heading = block
      end
    else
      local cell_div = nil
      local subfloat = _quarto.ast.resolve_custom_data(block)

      -- if we were given a scaffolding div like cell-output-display, etc,
      -- we use it.
      if subfloat == nil and is_regular_node(block, "Div") then
        -- https://github.com/quarto-dev/quarto-cli/issues/4370
        -- there can exist code blocks to be lifted into preamble deep inside divs, we need 
        -- to walk the div to find them
        cell_div = _quarto.ast.walk(block, {
          CodeBlock = function(code_block)
            if is_preamble_block(code_block) then
              handle_preamble_codeblock(code_block)
              return {}
            end
          end
        }) or pandoc.Div({}) -- unnecessary but the Lua analyzer doesn't know it
      else
        cell_div = pandoc.Div(block)
      end

      if subfloat ~= nil and subfloat.t == "FloatRefTarget" then
        transfer_float_image_width_to_cell(subfloat, cell_div)
      end
      
      -- if we have a heading then insert it
      if heading then 
        cell_div.content:insert(1, heading)
        heading = nil
      end

      -- if this is .cell-output-display that isn't a figure or table 
      -- then unroll multiple blocks
      local is_subfloat
      _quarto.ast.walk(cell_div, {
        FloatRefTarget = function(float)
          is_subfloat = true
          return nil
        end
      })
      if cell_div.attr.classes:find("cell-output-display") and is_subfloat == nil then
        for _,output_block in ipairs(cell_div.content) do
          if is_regular_node(output_block, "Div") then
            cells:insert(output_block)
          else
            cells:insert(pandoc.Div(output_block))
          end
        end
      else
        -- add the div
        cells:insert(cell_div)
      end
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

