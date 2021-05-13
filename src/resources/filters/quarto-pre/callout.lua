-- callout.lua
-- Copyright (C) 2021 by RStudio, PBC

local calloutidx = 1

function callout() 
  return {
  
    -- Insert paragraphs between consecutive callouts or tables for docx
    Blocks = function(blocks)
      if isDocxOutput() then
        local lastWasCallout = false
        local lastWasTable = false
        local newBlocks = pandoc.List:new()
        for i,el in pairs(blocks) do 
          -- determine what this block is
          local isCallout = el.t == "Div" and el.attr.classes:find_if(isDocxCallout)
          local isTable = el.t == "Table" or isFigureDiv(el) or (discoverFigure(el, true) ~= nil)
          local isCodeBlock = el.t == "CodeBlock"
          
          -- insert spacer if appropriate
          local insertSpacer = false
          if isCallout and (lastWasCallout or lastWasTable) then
            insertSpacer = true
          end
          if isCodeBlock and lastWasCallout then
            insertSpacer = true
          end
          if insertSpacer then
            newBlocks:insert(pandoc.Para(stringToInlines(" ")))
          end

          -- always insert
          newBlocks:insert(el)

          -- record last state
          lastWasCallout = isCallout
          lastWasTable = isTable

        end

        if #newBlocks > #blocks then
          return newBlocks
        else
          return nil
        end
      end
    end,

    -- Convert callout Divs into the appropriate element for this format
    Div = function(div)
      if div.attr.classes:find_if(isCallout) then
        preState.hasCallouts = true
        if isHtmlOutput() and not isEpubOutput() then
          return calloutDiv(div) 
        elseif isLatexOutput() then
          return calloutLatex(div)
        elseif isDocxOutput() then
          return calloutDocx(div)
        elseif isEpubOutput() then
          return epubCallout(div)
        else
          return simpleCallout(div)
        end
      end  
    end
  }
end

function isCallout(class)
  return class == 'callout' or class:match("^callout%-")
end

function isDocxCallout(class)
  return class == "docx-callout"
end

function calloutType(div)
  for _, class in ipairs(div.attr.classes) do
    if isCallout(class) then 
      return class:match("^callout%-(.*)")
    end
  end
  return nil
end

-- an HTML callout div
function calloutDiv(div)

  -- the first heading is the caption
  local caption = resolveHeadingCaption(div)
  local type = calloutType(div)

  local icon = div.attr.attributes["icon"]
  div.attr.attributes["icon"] = nil

  local collapse = div.attr.attributes["collapse"]
  div.attr.attributes["collapse"] = nil

  -- Make an outer card div and transfer classes
  local calloutDiv = pandoc.Div({})
  calloutDiv.attr.classes = div.attr.classes:clone()
  div.attr.classes = pandoc.List:new() 

  -- add card attribute
  calloutDiv.attr.classes:insert("callout")

  -- the image placeholder
  local noicon = ""
  if icon == "false" or type == nil then
    noicon = "no-icon"
    calloutDiv.attr.classes:insert("no-icon")
  end
  local imgPlaceholder = pandoc.Plain({pandoc.RawInline("html", "<i class='callout-icon" .. noicon .. "'></i>")});       
  local imgDiv = pandoc.Div({imgPlaceholder}, pandoc.Attr("", {"callout-icon-container"}));

  -- show a captioned callout
  if caption ~= nil then

    -- mark the callout as being captioned
    calloutDiv.attr.classes:insert("callout-captioned")

    -- create a unique id for the callout
    local calloutid = "callout-" .. calloutidx
    calloutidx = calloutidx + 1

    -- create the header to contain the caption
    -- caption should expand to fill its space
    local captionDiv = pandoc.Div(pandoc.Plain(caption), pandoc.Attr("", {"flex-fill"}))
    local headerDiv = pandoc.Div({imgDiv, captionDiv}, pandoc.Attr("", {"callout-header", "d-flex", "align-content-center"}))
    local bodyDiv = div
    bodyDiv.attr.classes:insert("callout-body")

    if collapse ~= nil then 

      -- collapse default value     
      local expandedAttrVal= "true"
      if collapse == "true" then
        expandedAttrVal = "false"
      end

      -- create the collapse button
      local btnClasses = "callout-btn-toggle btn d-inline-block border-0 py-1 ps-1 pe-0 float-end"
      local btnIcon = "<i class='callout-toggle'></i>"
      local toggleButton = pandoc.RawInline("html", "<button type='button' class='" .. btnClasses .. "'>" .. btnIcon .. "</button>")
      headerDiv.content:insert(pandoc.Plain(toggleButton));

      -- configure the header div for collapse
      headerDiv.attr.attributes["bs-toggle"] = "collapse"
      headerDiv.attr.attributes["bs-target"] = "#" .. calloutid
      headerDiv.attr.attributes["aria-controls"] = calloutid
      headerDiv.attr.attributes["aria-expanded"] = expandedAttrVal
      headerDiv.attr.attributes["aria-label"] = 'Toggle callout'

      -- configure the body div for collapse
      local collapseDiv = pandoc.Div({})
      collapseDiv.attr.identifier = calloutid
      collapseDiv.attr.classes:insert("callout-collapse")
      collapseDiv.attr.classes:insert("collapse")
      if expandedAttrVal == "true" then
        collapseDiv.attr.classes:insert("show")
      end

      -- add the current body to the collapse div and use the collapse div instead
      collapseDiv.content:insert(bodyDiv)
      bodyDiv = collapseDiv
    end

    -- add the header and body to the div
    calloutDiv.content:insert(headerDiv)
    calloutDiv.content:insert(bodyDiv)

  else 
    -- show an uncaptioned callout
  
    -- create a card body
    local containerDiv = pandoc.Div({imgDiv, div}, pandoc.Attr("", {"callout-body"}))
    containerDiv.attr.classes:insert("d-flex")

    -- add the container to the callout card
    calloutDiv.content:insert(containerDiv)
  end
  
  return calloutDiv
end

-- Latex awesomebox callout
function calloutLatex(div)
  
  -- read and clear attributes
  local caption = resolveHeadingCaption(div)
  local type = calloutType(div)
  local icon = div.attr.attributes["icon"]
  div.attr.attributes["icon"] = nil
  div.attr.attributes["caption"] = nil
  div.attr.attributes["collapse"] = nil

  local calloutContents = pandoc.List:new({});
    
  -- Add the captions and contents
  if caption ~= nil then 
    calloutContents:insert(pandoc.Para(pandoc.Strong(caption)))
  end
  tappend(calloutContents, div.content)

  -- Add the environment info, using inlines if possible 
  local color = latexColorForType(type)
  local leftMarginWidth = '0'
  local iconForType = iconForType(type)
  local iconName = ''
  if icon ~= false and iconForType ~= nil then
    iconName = '\\' .. iconForType
    leftMarginWidth = '0.12'
  end
  local separatorWidth = '1pt'

  local leftMargin = pandoc.RawInline('latex', '\\setlength{\\aweboxleftmargin}{' .. leftMarginWidth .. '\\linewidth}');
  local beginEnvironment = pandoc.RawInline('latex', '\\begin{awesomeblock}[' .. color .. ']{' .. separatorWidth .. '}{' .. iconName .. '}{' .. color ..'}\n')
  local endEnvironment = pandoc.RawInline('latex', '\n\\end{awesomeblock}')
  if calloutContents[1].t == "Para" and calloutContents[#calloutContents].t == "Para" then
    table.insert(calloutContents[1].content, 1, beginEnvironment)
    table.insert(calloutContents[1].content, 1, leftMargin)
    table.insert(calloutContents[#calloutContents].content, endEnvironment)
  else
    table.insert(calloutContents, 1, pandoc.Para({beginEnvironment}))
    table.insert(calloutContents, pandoc.Para({endEnvironment}))
  end
  return pandoc.Div(calloutContents)
end

function calloutDocx(div) 

  local hasIcon, type, contents = resolveCalloutContents(div, false)
  local color = htmlColorForType(type)

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

  local prefix = pandoc.List:new({
    pandoc.RawBlock("openxml", tablePrefix:gsub('$color', color)),
  })

  local calloutImage = docxCalloutImage(type)
  if hasIcon ~= "false" and calloutImage ~= nil then
    local imagePara = pandoc.Para({
      pandoc.RawInline("openxml", '<w:pPr>\n<w:spacing w:before="0" w:after="0" />\n<w:jc w:val="center" />\n</w:pPr>'), calloutImage})
    prefix:insert(pandoc.RawBlock("openxml", '<w:tcPr><w:tcMar><w:left w:w="144" w:type="dxa" /><w:right w:w="144" w:type="dxa" /></w:tcMar></w:tcPr>'))
    prefix:insert(imagePara)
    prefix:insert(pandoc.RawBlock("openxml",  "</w:tc>\n<w:tc>"))
  else     
    prefix:insert(pandoc.RawBlock("openxml", '<w:tcPr><w:tcMar><w:left w:w="144" w:type="dxa" /></w:tcMar></w:tcPr>'))
  end

  local suffix = pandoc.List:new({pandoc.RawBlock("openxml", [[
    </w:tc>
    </w:tr>
  </w:tbl>
  ]])})

  local calloutContents = pandoc.List:new({});
  tappend(calloutContents, prefix)
  
  -- convert to open xml paragraph
  removeParagraphPadding(contents)
  
  tappend(calloutContents, contents)
  tappend(calloutContents, suffix)

  local callout = pandoc.Div(calloutContents, pandoc.Attr("", {"docx-callout"}))
  return callout
end

function epubCallout(div)
  -- read the caption and type info
  local hasIcon = div.attr.attributes["icon"]
  local caption = resolveHeadingCaption(div)
  local type = calloutType(div)
  
  -- the body of the callout
  local calloutBody = pandoc.Div({}, pandoc.Attr("", {"callout-body"}))

  -- caption
  if caption ~= nil then
    local calloutCaption = pandoc.Div(pandoc.Para(pandoc.Strong(caption)), pandoc.Attr("", {"callout-caption"}))
    calloutBody.content:insert(calloutCaption)
  end

  -- contents 
  local calloutContents = pandoc.Div(div.content, pandoc.Attr("", {"callout-content"}))
  calloutBody.content:insert(calloutContents)

  -- set attributes (including hiding icon)
  local attributes = pandoc.List({"callout"})
  if type ~= nil then
    attributes:insert("callout-" .. type)
  end
  if hasIcon == 'false' then
    attributes:insert("no-icon")
  end

  return pandoc.Div({calloutBody}, pandoc.Attr("", attributes))
end

function simpleCallout(div) 
  local icon, type, contents = resolveCalloutContents(div, true)
  local callout = pandoc.BlockQuote(contents)
  return pandoc.Div(callout)
end

function resolveCalloutContents(div, requireCaption)
  local caption = resolveHeadingCaption(div)
  local type = calloutType(div)
  local icon = div.attr.attributes["icon"]
  
  div.attr.attributes["caption"] = nil
  div.attr.attributes["icon"] = nil
  div.attr.attributes["collapse"] = nil

  local contents = pandoc.List:new({});
    
  -- Add the captions and contents
  -- classname 
  if caption == nil and requireCaption then 
    caption = stringToInlines(type:sub(1,1):upper()..type:sub(2))
  end
  
  -- raw paragraph with styles (left border, colored)
  if caption ~= nil then
    contents:insert(pandoc.Para(pandoc.Strong(caption),  pandoc.Attr("", {'callout-caption'})))
  end
  tappend(contents, div.content)

  return icon, type, contents
end

function removeParagraphPadding(contents) 
  if #contents > 0 then

    if #contents == 1 then
      if contents[1].t == "Para" then
        contents[1] = openXmlPara(contents[1], 'w:before="0" w:after="0"')
      end  
    else
      if contents[1].t == "Para" then 
        contents[1] = openXmlPara(contents[1], 'w:before="0"')
      end

      if contents[#contents].t == "Para" then 
        contents[#contents] = openXmlPara(contents[#contents], 'w:after="0"')
      end
    end
  end
end

function openXmlPara(para, spacing) 
  local xmlPara = pandoc.Para({
    pandoc.RawInline("openxml", "<w:pPr>\n<w:spacing " .. spacing .. "/>\n</w:pPr>")
  })
  tappend(xmlPara.content, para.content)
  return xmlPara
end


function docxCalloutImage(type)

  -- try to form the svg name
  local svg = nil
  if type ~= nil then
    svg = param("icon-" .. type, nil)
  end

  -- lookup the image
  if svg ~= nil then
    local img = pandoc.Image({}, svg)
    img.attr.attributes["width"] = 16
    img.attr.attributes["height"] = 16
    return img
  else
    return nil
  end
end

function htmlColorForType(type) 
  if type == 'note' then
    return kColorNote
  elseif type == "warning" then
    return kColorWarning
  elseif type == "important" then
    return kColorImportant
  elseif type == "caution" then
    return kColorDanger
  elseif type == "tip" then 
    return kColorTip
  else
    return kColorUnknown
  end
end

function latexColorForType(type) 
  if type == 'note' then
    return "quarto-callout-note-color"
  elseif type == "warning" then
    return "quarto-callout-warning-color"
  elseif type == "important" then
    return "quarto-callout-important-color"
  elseif type == "caution" then
    return "quarto-callout-caution-color"
  elseif type == "tip" then 
    return "quarto-callout-tip-color"
  else
    return "quarto-callout-color"
  end
end

function iconForType(type) 
  if type == 'note' then
    return "faInfo"
  elseif type == "warning" then
    return "faExclamationTriangle"
  elseif type == "important" then
    return "faExclamation"
  elseif type == "caution" then
    return "faBurn"
  elseif type == "tip" then 
    return "faLightbulb"
  else
    return nil
  end
end