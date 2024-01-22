-- docx.lua
-- Copyright (C) 2020-2022 Posit Software, PBC


function tableDocxPanel(divEl, layout, caption)
  return tablePanel(divEl, layout, caption, {
    pageWidth = wpPageWidth(),
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


-- create a native docx caption 
function docxDivCaption(captionEl, align)
  local caption = pandoc.Para({
    pandoc.RawInline("openxml", docxParaStyles(align))
  })
  tappend(caption.content, captionEl.content)
  return caption
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
    return "left"
  elseif align == "center" then
    return "center"
  elseif align == "right" then
    return "right"
  else
    return nil
  end
end



