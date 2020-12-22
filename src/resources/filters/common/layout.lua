-- layout.lua
-- Copyright (C) 2020 by RStudio, PBC

kLayoutAlign = "layout.align"
kLayoutNcol = "layout.ncol"
kLayoutNrow = "layout.nrow"
kLayout = "layout"

function layoutAlignAttribute(el)
  return attribute(el, "layout.align", "center")
end

function hasLayoutAttributes(el)
  local attribs = tkeys(el.attr.attributes)
  return attribs:includes(kLayoutNrow) or
         attribs:includes(kLayoutNcol) or
         attribs.includes(kLayout)
end



-- locate an image in a layout cell
function figureImageFromLayoutCell(cellDivEl)
  for _,block in ipairs(cellDivEl.content) do
    local fig = discoverFigure(block, false)
    if not fig then
      fig = discoverLinkedFigure(block, false)
    end
    if not fig then
      fig = discoverLinkedFigureDiv(block, false)
    end
    if fig then
      return fig
    end
  end
  return nil
end


-- we often wrap a table in a div, unwrap it
function tableFromLayoutCell(cell)
  if #cell.content == 1 and cell.content[1].t == "Table" then
    return cell.content[1]
  else
    return nil
  end
end

-- does the layout cell have a ref parent
function layoutCellHasRefParent(cell)
  if hasRefParent(cell) then
    return true
  else
    local image = figureImageFromLayoutCell(cell)
    if image then
      return hasRefParent(image)
    end
  end
  return false
end

