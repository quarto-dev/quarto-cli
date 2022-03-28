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
        local newBlocks = pandoc.List()
        for i,el in ipairs(blocks) do 
          -- determine what this block is
          local isCallout = el.t == "Div" and el.attr.classes:find_if(isDocxCallout)
          local isTable = el.t == "Table" or isFigureDiv(el) or (discoverFigure(el, true) ~= nil)
          local isCodeBlock = el.t == "CodeBlock"

          -- Determine whether this is a code cell that outputs a table
          local isCodeCell = el.t == "Div" and el.attr.classes:find_if(isCodeCell)
          if isCodeCell and isCodeCellTable(el) then 
            isTable = true;
          end
          
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
        if isHtmlOutput() and hasBootstrap() then
          return calloutDiv(div) 
        elseif isLatexOutput() then
          return calloutLatex(div)
        elseif isDocxOutput() then
          return calloutDocx(div)
        elseif isEpubOutput() or isRevealJsOutput() then
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

function isCodeCell(class)
  return class == "cell"
end

function isCodeCellDisplay(class)
  return class == "cell-output-display"
end

-- Attempts to detect whether this element is a code cell
-- whose output is a table
function isCodeCellTable(el) 
  local isTable = false
  pandoc.walk_block(el, {
    Div = function(div) 
      if div.attr.classes:find_if(isCodeCellDisplay) then
        pandoc.walk_block(div, {
          Table = function(tbl)
            isTable = true
          end
        })
      end
    end
  })
  return isTable
end

function calloutType(div)
  for _, class in ipairs(div.attr.classes) do
    if isCallout(class) then 
      local type = class:match("^callout%-(.*)")
      if type == nil then
        type = "none"
      end
      return type
    end
  end
  return nil
end

local kCalloutAppearanceDefault = "default"
local kCalloutDefaultSimple = "simple"
local kCalloutDefaultMinimal = "minimal"

-- an HTML callout div
function calloutDiv(div)

  -- the first heading is the caption
  local caption = resolveHeadingCaption(div)
  local type = calloutType(div)

  -- the callout type
  local processedCallout = processCalloutDiv(div)
  local calloutAppearance = processedCallout.appearance
  local icon = processedCallout.icon

  if calloutAppearance == kCalloutAppearanceDefault and caption == nil then
    caption = displayName(type)
  end

  local collapse = div.attr.attributes["collapse"]
  div.attr.attributes["collapse"] = nil

  -- Make an outer card div and transfer classes
  local calloutDiv = pandoc.Div({})
  calloutDiv.attr.classes = div.attr.classes:clone()
  div.attr.classes = pandoc.List() 
  div.attr.classes:insert("callout-body-container")

  -- add card attribute
  calloutDiv.attr.classes:insert("callout")
  calloutDiv.attr.classes:insert("callout-style-" .. calloutAppearance)

  -- the image placeholder
  local noicon = ""

  -- Check to see whether this is a recognized type
  if icon == false or not isBuiltInType(type) or type == nil then
    noicon = " no-icon"
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
    local captionDiv = pandoc.Div(pandoc.Plain(caption), pandoc.Attr("", {"callout-caption-container", "flex-fill"}))
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
      local btnClasses = "callout-btn-toggle d-inline-block border-0 py-1 ps-1 pe-0 float-end"
      local btnIcon = "<i class='callout-toggle'></i>"
      local toggleButton = pandoc.RawInline("html", "<div class='" .. btnClasses .. "'>" .. btnIcon .. "</div>")
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

-- Latex callout
function calloutLatex(div)
  
  -- read and clear attributes
  local caption = resolveHeadingCaption(div)
  local type = calloutType(div)

  local processedCallout = processCalloutDiv(div)
  local calloutAppearance = processedCallout.appearance
  local icon = processedCallout.icon

  div.attr.attributes["caption"] = nil
  div.attr.attributes["collapse"] = nil

  -- generate the callout box
  local callout
  if calloutAppearance == kCalloutAppearanceDefault then
    if caption == nil then
      caption = displayName(type)
    else
      caption = pandoc.write(pandoc.Pandoc(pandoc.Plain(caption)), 'latex')
    end
    callout = latexCalloutBoxDefault(caption, type, icon)
  else
    callout = latexCalloutBoxSimple(caption, type, icon)
  end
  local beginEnvironment = callout.beginInlines
  local endEnvironment = callout.endInlines
  local calloutContents = callout.contents
  if classoutContents == nil then
    calloutContents = pandoc.List({})
  end

  tappend(calloutContents, div.content)
  
  if calloutContents[1] ~= nil and calloutContents[1].t == "Para" and calloutContents[#calloutContents].t == "Para" then
    tprepend(calloutContents[1].content, beginEnvironment)
    tappend(calloutContents[#calloutContents].content, endEnvironment)
  else
    tprepend(calloutContents, { pandoc.Para(beginEnvironment) })
    tappend(calloutContents, { pandoc.Para(endEnvironment) })
  end


  return pandoc.Div(calloutContents)
end

function latexCalloutBoxDefault(caption, type, icon) 

  -- callout dimensions
  local leftBorderWidth = '.75mm'
  local borderWidth = '.15mm'
  local borderRadius = '.35mm'
  local leftPad = '2mm'
  local color = latexColorForType(type)
  local frameColor = latexFrameColorForType(type)

  local iconForType = iconForType(type)

  -- generate options
  local options = {
    colframe = frameColor,
    colbacktitle = color ..'!10!white',
    coltitle = 'black',
    colback = 'white',
    opacityback = 0,
    opacitybacktitle =  0.6,
    left = leftPad,
    leftrule = leftBorderWidth,
    toprule = borderWidth, 
    bottomrule = borderWidth,
    rightrule = borderWidth,
    arc = borderRadius,
    title = '{' .. caption .. '}',
    titlerule = '0mm',
    toptitle = '1mm',
    bottomtitle = '1mm',
  }

  if icon ~= false and iconForType ~= nil then
    options.title = '\\textcolor{' .. color .. '}{\\' .. iconForType .. '}\\hspace{0.5em}' ..  options.title
  end

  -- the core latex for the box
  local beginInlines = { pandoc.RawInline('latex', '\\begin{tcolorbox}[standard jigsaw,' .. tColorOptions(options) .. ']\n') }
  local endInlines = { pandoc.RawInline('latex', '\n\\end{tcolorbox}') }

  -- Add the captions and contents
  local calloutContents = pandoc.List({});

  -- the inlines
  return { 
    contents = calloutContents,
    beginInlines = beginInlines, 
    endInlines = endInlines
  }

end

-- create the tcolorBox
function latexCalloutBoxSimple(caption, type, icon)

  -- callout dimensions
  local leftBorderWidth = '.75mm'
  local borderWidth = '.15mm'
  local borderRadius = '.35mm'
  local leftPad = '2mm'
  local color = latexColorForType(type)
  local colorFrame = latexFrameColorForType(type)

  -- generate options
  local options = {
    colframe = colorFrame,
    colback = 'white',
    opacityback = 0,
    left = leftPad,
    leftrule = leftBorderWidth,
    toprule = borderWidth, 
    bottomrule = borderWidth,
    rightrule = borderWidth,
    arc = borderRadius,
  }

  -- the core latex for the box
  local beginInlines = { pandoc.RawInline('latex', '\\begin{tcolorbox}[standard jigsaw, ' .. tColorOptions(options) .. ']\n') }
  local endInlines = { pandoc.RawInline('latex', '\n\\end{tcolorbox}') }

  -- generate the icon and use a minipage to position it
  local iconForCat = iconForType(type)
  if icon ~= false and iconForCat ~= nil then
    local iconName = '\\' .. iconForCat
    local iconColSize = '5.5mm'

    -- add an icon to the begin
    local iconTex = '\\begin{minipage}[t]{' .. iconColSize .. '}\n\\textcolor{' .. color .. '}{' .. iconName .. '}\n\\end{minipage}%\n\\begin{minipage}[t]{\\textwidth - ' .. iconColSize .. '}\n'
    tappend(beginInlines, {pandoc.RawInline('latex',  iconTex)})

    -- close the icon
    tprepend(endInlines, {pandoc.RawInline('latex', '\\end{minipage}%')});
  end

  -- Add the captions and contents
  local calloutContents = pandoc.List({});
  if caption ~= nil then 
    tprepend(caption, {pandoc.RawInline('latex', '\\textbf{')})
    tappend(caption, {pandoc.RawInline('latex', '}\\vspace{2mm}')})
    calloutContents:insert(pandoc.Para(caption))
  end

  -- the inlines
  return { 
    contents = calloutContents,
    beginInlines = beginInlines, 
    endInlines = endInlines
  }
end

function processCalloutDiv(div) 

  local type = calloutType(div)
  local iconDefault = true
  local appearanceDefault = nil
  if type == "none" then
    iconDefault = false
    appearanceDefault = "simple"
  end

  local icon = div.attr.attributes["icon"]
  div.attr.attributes["icon"] = nil
  if icon == nil then
    icon = option("callout-icon", iconDefault)
  elseif icon == "false" then
    icon = false
  end
  

  local appearanceRaw = div.attr.attributes["appearance"]
  div.attr.attributes["appearance"] = nil
  if appearanceRaw == nil then
    appearanceRaw = option("callout-appearance", appearanceDefault)
  end
  
  local appearance = nameForCalloutStyle(appearanceRaw);
  if appearance == "minimal" then
    icon = false
    appearance = "simple"
  end

  return { icon = icon, appearance = appearance}

end

function calloutDocx(div)
  local type = calloutType(div)
  local processedCallout = processCalloutDiv(div)
  local appearance = processedCallout.appearance
  local hasIcon = processedCallout.icon 

  if appearance == kCalloutAppearanceDefault then
    return calloutDocxDefault(div, type, hasIcon)
  else
    return calloutDocxSimple(div, type, hasIcon)
  end
end


function calloutDocxDefault(div, type, hasIcon)

  local caption = resolveHeadingCaption(div)  
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

  -- Create a caption if there isn't already one
  if caption == nil then
    caption = pandoc.List({pandoc.Str(displayName(type))})
  end

  -- add the image to the caption, if needed
  local calloutImage = docxCalloutImage(type);
  if hasIcon and calloutImage ~= nil then
    -- Create a paragraph with the icon, spaces, and text
    local imageCaption = pandoc.List({
        pandoc.RawInline("openxml", '<w:pPr>\n<w:spacing w:before="0" w:after="0" />\n<w:textAlignment w:val="center"/>\n</w:pPr>'), 
        calloutImage,
        pandoc.Space(), 
        pandoc.Space()})
    tappend(imageCaption, caption)
    calloutContents:insert(pandoc.Para(imageCaption))
  else
    local captionRaw = openXmlPara(pandoc.Para(caption), 'w:before="16" w:after="16"')
    calloutContents:insert(captionRaw)  
  end

  
  -- end the caption row and start the body row
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
  local contents = div.content

  -- ensure there are no nested callouts
  if contents:find_if(function(el) 
    return el.t == "Div" and el.attr.classes:find_if(isDocxOutput) ~= nil 
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


function calloutDocxSimple(div, type, hasIcon) 

  local color = htmlColorForType(type)
  local caption = resolveHeadingCaption(div)  

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

  local calloutContents = pandoc.List({});
  tappend(calloutContents, prefix)

  -- deal with the caption, if present
  if caption ~= nil then
    local captionPara = pandoc.Para(pandoc.Strong(caption))
    calloutContents:insert(openXmlPara(captionPara, 'w:before="16" w:after="64"'))
  end
  
  -- convert to open xml paragraph
  local contents = div.content;
  removeParagraphPadding(contents)
  
  -- ensure there are no nested callouts
  if contents:find_if(function(el) 
    return el.t == "Div" and el.attr.classes:find_if(isDocxOutput) ~= nil 
  end) ~= nil then
    fail("Found a nested callout in the document. Please fix this issue and try again.")
  end

  tappend(calloutContents, contents)
  tappend(calloutContents, suffix)

  local callout = pandoc.Div(calloutContents, pandoc.Attr("", {"docx-callout"}))
  return callout
end

function epubCallout(div)
  -- read the caption and type info
  local caption = resolveHeadingCaption(div)
  local type = calloutType(div)
  
  -- the callout type
  local processedCallout = processCalloutDiv(div)
  local calloutAppearance = processedCallout.appearance
  local hasIcon = processedCallout.icon

  if calloutAppearance == kCalloutAppearanceDefault and caption == nil then
    caption = displayName(type)
  end
  
  -- the body of the callout
  local calloutBody = pandoc.Div({}, pandoc.Attr("", {"callout-body"}))

  local imgPlaceholder = pandoc.Plain({pandoc.RawInline("html", "<i class='callout-icon'></i>")});       
  local imgDiv = pandoc.Div({imgPlaceholder}, pandoc.Attr("", {"callout-icon-container"}));

  -- caption
  if caption ~= nil then
    local calloutCaption = pandoc.Div({}, pandoc.Attr("", {"callout-caption"}))
    if hasIcon then
      calloutCaption.content:insert(imgDiv)
    end
    calloutCaption.content:insert(pandoc.Para(pandoc.Strong(caption)))
    calloutBody.content:insert(calloutCaption)
  else 
    if hasIcon then
      calloutBody.content:insert(imgDiv)
    end
  end

  -- contents 
  local calloutContents = pandoc.Div(div.content, pandoc.Attr("", {"callout-content"}))
  calloutBody.content:insert(calloutContents)

  -- set attributes (including hiding icon)
  local attributes = pandoc.List({"callout"})
  if type ~= nil then
    attributes:insert("callout-" .. type)
  end

  if hasIcon == false then
    attributes:insert("no-icon")
  end
  if caption ~= nil then
    attributes:insert("callout-captioned")
  end
  attributes:insert("callout-style-" .. calloutAppearance)

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

  local contents = pandoc.List({});
    
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

function openXmlPara(para, spacing) 
  local xmlPara = pandoc.Para({
    pandoc.RawInline("openxml", "<w:pPr>\n<w:spacing " .. spacing .. "/>\n</w:pPr>")
  })
  tappend(xmlPara.content, para.content)
  return xmlPara
end

function nameForCalloutStyle(calloutType) 
  if calloutType == nil then
    return "default"
  else 
    local name = pandoc.utils.stringify(calloutType);

    if name:lower() == "minimal" then
      return "minimal"
    elseif name:lower() == "simple" then
      return "simple"
    else
      return "default"
    end
  end
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
    return kColorCaution
  elseif type == "tip" then 
    return kColorTip
  else
    return kColorUnknown
  end
end

function htmlBackgroundColorForType(type)
  if type == 'note' then
    return kBackgroundColorNote
  elseif type == "warning" then
    return kBackgroundColorWarning
  elseif type == "important" then
    return kBackgroundColorImportant
  elseif type == "caution" then
    return kBackgroundColorCaution
  elseif type == "tip" then 
    return kBackgroundColorTip
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

function latexFrameColorForType(type) 
  if type == 'note' then
    return "quarto-callout-note-color-frame"
  elseif type == "warning" then
    return "quarto-callout-warning-color-frame"
  elseif type == "important" then
    return "quarto-callout-important-color-frame"
  elseif type == "caution" then
    return "quarto-callout-caution-color-frame"
  elseif type == "tip" then 
    return "quarto-callout-tip-color-frame"
  else
    return "quarto-callout-color-frame"
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
    return "faFire"
  elseif type == "tip" then 
    return "faLightbulb"
  else
    return nil
  end
end

function isBuiltInType(type) 
  local icon = iconForType(type)
  return icon ~= nil
end

function displayName(type)
  local defaultName = type:sub(1,1):upper()..type:sub(2)
  return param("callout-" .. type .. "-caption", defaultName)
end