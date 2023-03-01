-- wp.lua
-- Copyright (C) 2020-2022 Posit Software, PBC


function tableWpPanel(divEl, layout, caption)
  return tablePanel(divEl, layout, caption, {
    pageWidth = wpPageWidth()
  })
end

function wpDivFigure(div)
  
  local align = figAlignAttribute(div)
  local capLoc = capLocation("fig", "bottom")

  local captionPara = div.content[2]:clone()
  local figurePara = div.content[1]:clone()

  -- Switch to modern alignment directives for OOXML
  local wordAligns = {
    left = "start",
    right = "end",
    center = "center"
  }

  -- Generate raw OOXML string that sets paragraph properties
  local docxAlign = "<w:pPr><w:pStyle w:val=\"Caption\" /><w:keepNext /><w:jc w:val=\"" .. wordAligns[align] .. "\"/></w:pPr>"
  
  captionPara.content:insert(1, pandoc.RawInline("openxml", docxAlign))

  if capLoc == "top" then
    
    return pandoc.Div({
      captionPara,
      figurePara
    })

  else
    -- "bottom" or default
    return pandoc.Div({
      figurePara,
      captionPara
    })  
  end
end

function wpPageWidth()
  local width = param("page-width", nil)
  if width then 
    if (type(width) == 'table') then
      width = tonumber(pandoc.utils.stringify(width))
    end

    if not width then
      error("You must use a number for page-width")
    else
      return width
    end
  else
    return 6.5
  end
end
