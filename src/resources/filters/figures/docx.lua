-- docx.lua
-- Copyright (C) 2020 by RStudio, PBC


function tableDocxPanel(divEl, sufigures)
  return tablePanel(divEl, sufigures, {
    pageWidth = officePageWidth(),
    rowBreak = docxRowBreak,
    divCaption = docxDivCaption
  })
end


function docxRowBreak()
  return pandoc.RawBlock("openxml", [[
<w:p>
  <w:pPr>
    <w:framePr w:w="0" w:h="0" w:vAnchor="margin" w:hAnchor="margin" w:xAlign="right" w:yAlign="top"/>
  </w:pPr>
</w:p>
]])
end


-- create a native docx caption (note that because "openxml" raw blocks
-- are parsed we need to provide a complete xml node, this implies that
-- we need to stringify the captionEl, losing any markdown therein)
function docxDivCaption(captionEl, align)
  local caption = 
    "<w:p>\n" ..
      "<w:pPr>\n"
  local captionAlign = docxAlign(align)
  if captionAlign then
    caption = caption .. 
        "<w:jc w:val=\"" .. captionAlign .. "\"/>\n"
  end  
  caption = caption ..
        "<w:spacing w:before=\"200\" />\n" ..
        "<w:pStyle w:val=\"ImageCaption\" />\n" ..
      "</w:pPr>\n"
  caption = caption ..
      "<w:r>\n" ..
        "<w:t xml:space=\"preserve\">" ..
         pandoc.utils.stringify(captionEl) .. 
        "</w:t>\n" ..
      "</w:r>"
  caption = caption ..
    "</w:p>\n"
    
  return pandoc.RawBlock("openxml", caption)
end

function docxAlign(align)
  if align == "left" then
    return "start"
  elseif align == "center" then
    return "center"
  elseif align == "right" then
    return "end"
  else
    return nil
  end
end



