-- docx.lua
-- Copyright (C) 2023 Posit Software, PBC
--
-- renders AST nodes to docx


local function calloutDocxDefault(node, type, hasIcon)
  local title = quarto.utils.as_inlines(node.title)
  local color = htmlColorForType(type)
  local backgroundColor = htmlBackgroundColorForType(type)

  local tablePrefix = [[
    <w:tbl>
    <w:tblPr>
      <w:tblStyle w:val="Table" />
      <w:tblLook w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="0" w:noVBand="0" w:val="0000" />
      <w:tblBorders>  
        <w:left w:val="single" w:sz="24" w:space="0" w:color="$color"/>  
        <w:right w:val="single" w:sz="4" w:space="0" w:color="$color"/>  
        <w:top w:val="single" w:sz="4" w:space="0" w:color="$color"/>  
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="$color"/>  
      </w:tblBorders> 
      <w:tblCellMar>
        <w:left w:w="144" w:type="dxa" />
        <w:right w:w="144" w:type="dxa" />
      </w:tblCellMar>
      <w:tblInd w:w="164" w:type="dxa" />
      <w:tblW w:type="pct" w:w="100%"/>
    </w:tblPr>
    <w:tr>
      <w:trPr>
        <w:cantSplit/>
      </w:trPr>
      <w:tc>
        <w:tcPr>
          <w:shd w:color="auto" w:fill="$background" w:val="clear"/>
          <w:tcMar>
            <w:top w:w="92" w:type="dxa" />
            <w:bottom w:w="92" w:type="dxa" />
          </w:tcMar>
        </w:tcPr>
  ]]
  local calloutContents = pandoc.List({
    pandoc.RawBlock("openxml", tablePrefix:gsub('$background', backgroundColor):gsub('$color', color)),
  })

  -- Create a title if there isn't already one
  if title == nil then
    title = pandoc.List({pandoc.Str(displayName(type))})
  end

  -- add the image to the title, if needed
  local calloutImage = docxCalloutImage(type);
  if hasIcon and calloutImage ~= nil then
    -- Create a paragraph with the icon, spaces, and text
    local image_title = pandoc.List({
        pandoc.RawInline("openxml", '<w:pPr>\n<w:spacing w:before="0" w:after="0" />\n<w:textAlignment w:val="center"/>\n</w:pPr>'), 
        calloutImage,
        pandoc.Space(), 
        pandoc.Space()})
    tappend(image_title, title)
    calloutContents:insert(pandoc.Para(image_title))
  else
    local titleRaw = openXmlPara(pandoc.Para(title), 'w:before="16" w:after="16"')
    calloutContents:insert(titleRaw)  
  end

  
  -- end the title row and start the body row
  local tableMiddle = [[
      </w:tc>
    </w:tr>
    <w:tr>
      <w:trPr>
        <w:cantSplit/>
      </w:trPr>
      <w:tc> 
      <w:tcPr>
        <w:tcMar>
          <w:top w:w="108" w:type="dxa" />
          <w:bottom w:w="108" w:type="dxa" />
        </w:tcMar>
      </w:tcPr>

  ]]
  calloutContents:insert(pandoc.Div(pandoc.RawBlock("openxml", tableMiddle)))  

  -- the main contents of the callout
  local contents = quarto.utils.as_blocks(node.content)

  -- ensure there are no nested callouts
  if contents:find_if(function(el) 
    return el.t == "Div" and el.attr.classes:find_if(isDocxCallout) ~= nil 
  end) ~= nil then
    fail("Found a nested callout in the document. Please fix this issue and try again.")
  end
  
  -- remove padding from existing content and add it
  removeParagraphPadding(contents)
  tappend(calloutContents, contents)

  -- close the table
  local suffix = pandoc.List({pandoc.RawBlock("openxml", [[
    </w:tc>
    </w:tr>
  </w:tbl>
  ]])})
  tappend(calloutContents, suffix)

  -- return the callout
  local callout = pandoc.Div(calloutContents, pandoc.Attr("", {"docx-callout"}))
  return callout
end


local function calloutDocxSimple(node, type, hasIcon) 
  local color = htmlColorForType(type)
  local title = quarto.utils.as_inlines(node.title)

  local tablePrefix = [[
    <w:tbl>
    <w:tblPr>
      <w:tblStyle w:val="Table" />
      <w:tblLook w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="0" w:noVBand="0" w:val="0000" />
      <w:tblBorders>  
        <w:left w:val="single" w:sz="24" w:space="0" w:color="$color"/>  
      </w:tblBorders> 
      <w:tblCellMar>
        <w:left w:w="0" w:type="dxa" />
        <w:right w:w="0" w:type="dxa" />
      </w:tblCellMar>
      <w:tblInd w:w="164" w:type="dxa" />
    </w:tblPr>
    <w:tr>
      <w:trPr>
        <w:cantSplit/>
      </w:trPr>
      <w:tc>
  ]]

  local prefix = pandoc.List({
    pandoc.RawBlock("openxml", tablePrefix:gsub('$color', color)),
  })

  local calloutImage = docxCalloutImage(type)
  if hasIcon and calloutImage ~= nil then
    local imagePara = pandoc.Para({
      pandoc.RawInline("openxml", '<w:pPr>\n<w:spacing w:before="0" w:after="8" />\n<w:jc w:val="center" />\n</w:pPr>'), calloutImage})
    prefix:insert(pandoc.RawBlock("openxml", '<w:tcPr><w:tcMar><w:left w:w="144" w:type="dxa" /><w:right w:w="144" w:type="dxa" /></w:tcMar></w:tcPr>'))
    prefix:insert(imagePara)
    prefix:insert(pandoc.RawBlock("openxml",  "</w:tc>\n<w:tc>"))
  else     
    prefix:insert(pandoc.RawBlock("openxml", '<w:tcPr><w:tcMar><w:left w:w="144" w:type="dxa" /></w:tcMar></w:tcPr>'))
  end

  local suffix = pandoc.List({pandoc.RawBlock("openxml", [[
    </w:tc>
    </w:tr>
  </w:tbl>
  ]])})

  local calloutContents = pandoc.List({})
  tappend(calloutContents, prefix)

  -- deal with the title, if present
  if title ~= nil then
    local titlePara = pandoc.Para(pandoc.Strong(title))
    calloutContents:insert(openXmlPara(titlePara, 'w:before="16" w:after="64"'))
  end
  
  -- convert to open xml paragraph
  local contents = pandoc.List({}) -- use as pandoc.List() for find_if
  contents:extend(quarto.utils.as_blocks(node.content))
  removeParagraphPadding(contents)
  
  -- ensure there are no nested callouts
  if contents:find_if(function(el) 
    return el.t == "Div" and el.attr.classes:find_if(isDocxCallout) ~= nil 
  end) ~= nil then
    fail("Found a nested callout in the document. Please fix this issue and try again.")
  end

  tappend(calloutContents, contents)
  tappend(calloutContents, suffix)

  local callout = pandoc.Div(calloutContents, pandoc.Attr("", {"docx-callout"}))
  return callout
end

local function calloutDocx(node)
  local type = node.type
  local appearance = node.appearance
  local hasIcon = node.icon 

  if appearance == kCalloutAppearanceDefault then
    return calloutDocxDefault(node, type, hasIcon)
  else
    return calloutDocxSimple(node, type, hasIcon)
  end
end

function render_docx()
  if not _quarto.format.isDocxOutput() then
    return {}
  end

  return {
    Callout = calloutDocx
  }
end