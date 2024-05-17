-- openxml.lua
-- Copyright (C) 2024 Posit Software, PBC

local function openXmlPara(para, spacing)
  local xmlPara = pandoc.Para({
    pandoc.RawInline("openxml", "<w:pPr>\n<w:spacing " .. spacing .. "/>\n</w:pPr>")
  })
  tappend(xmlPara.content, para.content)
  return xmlPara
end

local function removeParagraphPadding(contents) 
  if #contents > 0 then

    if #contents == 1 then
      if contents[1].t == "Para" then
        contents[1] = openXmlPara(contents[1], 'w:before="16" w:after="16"')
      end  
    else
      if contents[1].t == "Para" then 
        contents[1] = openXmlPara(contents[1], 'w:before="16"')
      end

      if contents[#contents].t == "Para" then 
        contents[#contents] = openXmlPara(contents[#contents], 'w:after="16"')
      end
    end
  end
end

return {
  -- TODO capitalization
  openXmlPara = openXmlPara,
  removeParagraphPadding = removeParagraphPadding
}