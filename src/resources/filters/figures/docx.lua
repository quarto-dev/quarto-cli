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
  
  -- for pandoc >= 2.11.3 we can render the captionEl
  local rawOpenxmlVersion = pandoc.types.Version("2.11.3")
  if PANDOC_VERSION < rawOpenxmlVersion then
    local caption = "<w:p>\n" 
    caption = caption .. docxParaStyles(align)
    caption = caption ..
        "<w:r>\n" ..
          "<w:t xml:space=\"preserve\">" ..
           pandoc.utils.stringify(captionEl) .. 
          "</w:t>\n" ..
        "</w:r>"
    caption = caption ..
      "</w:p>\n"
    return pandoc.RawBlock("openxml", caption)
    
  else
    local caption = pandoc.Para({
      pandoc.RawInline("openxml", docxParaStyles(align))
    })
    tappend(caption.content, captionEl.content)
    return caption
  end
  
end

function docxParaStyles(align)
  local styles = "<w:pPr>\n"
  local captionAlign = docxAlign(align)
  if captionAlign then
    styles = styles .. 
        "<w:jc w:val=\"" .. captionAlign .. "\"/>\n"
  end  
  styles = styles ..
    "<w:spacing w:before=\"200\" />\n" ..
    "<w:pStyle w:val=\"ImageCaption\" />\n" ..
    "</w:pPr>\n"
  return styles
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



