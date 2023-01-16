-- odt.lua
-- Copyright (C) 2020-2022 Posit Software, PBC


function tableOdtPanel(divEl, layout, caption)
  return tablePanel(divEl, layout, caption, {
    pageWidth = wpPageWidth(),
    divCaption = odtDivCaption
  })
end

-- create a native odt caption (note that because "opendocument" paragraphs
-- include their styles as an attribute, we need to stringify the captionEl
-- so that it can be embedded in a raw opendocument block
function odtDivCaption(captionEl, align)
  local caption = pandoc.RawBlock("opendocument", 
    "<text:p text:style-name=\"FigureCaption\">" ..
    pandoc.utils.stringify(captionEl) .. 
    "</text:p>"
  )
  return caption
end



