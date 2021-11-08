-- layout.lua
-- Copyright (C) 2020 by RStudio, PBC

-- required version
PANDOC_VERSION:must_be_at_least '2.13'

-- required modules
text = require 'text'

-- global layout state
layoutState = {
  hasColumns = false,
}

-- [import]
function import(script)
  local path = PANDOC_SCRIPT_FILE:match("(.*[/\\])")
  dofile(path .. script)
end
import("meta.lua")
import("width.lua")
import("latex.lua")
import("html.lua")
import("wp.lua")
import("docx.lua")
import("odt.lua")
import("pptx.lua")
import("table.lua")
import("figures.lua")
import("cites.lua")
import("columns.lua")
import("options.lua")
import("columns-preprocess.lua")
import("../common/json.lua")
import("../common/latex.lua")
import("../common/pandoc.lua")
import("../common/validate.lua")
import("../common/format.lua")
import("../common/refs.lua")
import("../common/layout.lua")
import("../common/figures.lua")
import("../common/options.lua")
import("../common/params.lua")
import("../common/meta.lua")
import("../common/table.lua")
import("../common/debug.lua")
import("../common/log.lua")
-- [/import]


function layoutPanels()

  return {
    Div = function(el)
      if requiresPanelLayout(el) then
        
        -- partition
        local preamble, cells, caption = partitionCells(el)
        
        -- derive layout
        local layout = layoutCells(el, cells)
        
        -- call the panel layout functions
        local panel
        if isLatexOutput() then
          panel = latexPanel(el, layout, caption)
        elseif isHtmlOutput() then
          panel = htmlPanel(el, layout, caption)
        elseif isDocxOutput() then
          panel = tableDocxPanel(el, layout, caption)
        elseif isOdtOutput() then
          panel = tableOdtPanel(el, layout, caption)
        elseif isWordProcessorOutput() then
          panel = tableWpPanel(el, layout, caption)
        elseif isPowerPointOutput() then
          panel = pptxPanel(el, layout, caption)
        else
          panel = tablePanel(el, layout, caption)
        end
        
        if #preamble > 0 then
          local div = pandoc.Div({})
          if #preamble > 0 then
            tappend(div.content, preamble)
          end
          div.content:insert(panel)
          return div
          
        -- otherwise just return the panel
        else
          return panel
        end
        
      end
    end
  }  
end


function requiresPanelLayout(divEl)
  
  if hasLayoutAttributes(divEl) then
    return true
  -- latex requires special layout markup for subcaptions
  elseif isLatexOutput() and hasSubRefs(divEl) then
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
      preamble:insert(block)
    elseif block.t == "Header" then
      heading = block
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
      
      -- add the div
      cells:insert(cellDiv)
      
    end
    
  end

  return preamble, cells, caption
  
end


function layoutCells(divEl, cells)
  
  -- layout to return (list of rows)
  local rows = pandoc.List()
  
  -- note any figure layout attributes
  local layoutRows = tonumber(attribute(divEl, kLayoutNrow, nil))
  local layoutCols = tonumber(attribute(divEl, kLayoutNcol, nil))
  local layout = attribute(divEl, kLayout, nil)
  
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
    function layoutNextCell(width)
      -- check for a spacer width (negative percent)
      if isSpacerWidth(width) then
        local cell = pandoc.Div({
          pandoc.Para({pandoc.Str(" ")}),
          pandoc.Para({})
        }, pandoc.Attr(
          "", 
          { "quarto-figure-spacer" }, 
          { width = text.sub(width, 2, #width) }
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
  local align = layoutAlignAttribute(divEl)
  
  -- some width and alignment handling
  rows = rows:map(function(row)
    return row:map(function(cell)
      
      -- percentage based layouts need to be scaled down so they don't overflow the page 
      local percentWidth = widthToPercent(attribute(cell, "width", nil))
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

function isPreambleBlock(el)
  return (el.t == "CodeBlock" and el.attr.classes:includes("cell-code")) or
         (el.t == "Div" and el.attr.classes:includes("cell-output-stderr"))
end

initParams()

-- chain of filters
return {
  initOptions(),
  columnsPreprocess(),
  columns(),
  citesPreprocess(),
  cites(),
  layoutPanels(),
  extendedFigures(),
  layoutMetaInject()
}


