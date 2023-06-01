-- callout.lua
-- Copyright (C) 2021-2022 Posit Software, PBC

local constants = require("modules/constants")

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

_quarto.ast.add_handler({
  -- use either string or array of strings
  class_name = { "callout", "callout-note", "callout-warning", "callout-important", "callout-caution", "callout-tip" },

  -- the name of the ast node, used as a key in extended ast filter tables
  ast_name = "Callout",

  -- callouts will be rendered as blocks
  kind = "Block",

  -- a function that takes the div node as supplied in user markdown
  -- and returns the custom node
  parse = function(div)
    quarto_global_state.hasCallouts = true
    local title = markdownToInlines(div.attr.attributes["title"])
    if not title or #title == 0 then
      title = resolveHeadingCaption(div)
    end
    local old_attr = div.attr
    local appearanceRaw = div.attr.attributes["appearance"]
    local icon = div.attr.attributes["icon"]
    local collapse = div.attr.attributes["collapse"]
    div.attr.attributes["appearance"] = nil
    div.attr.attributes["collapse"] = nil
    div.attr.attributes["icon"] = nil
    local callout_type = calloutType(div)
    div.attr.classes = div.attr.classes:filter(function(class) return not isCallout(class) end)
    return quarto.Callout({
      appearance = appearanceRaw,
      title = title,
      collapse = collapse,
      content = div.content,
      icon = icon,
      type = callout_type,
      attr = old_attr,
    })
  end,

  -- These fields will be stored in the extended ast node
  -- and available in the object passed to the custom filters
  -- They must store Pandoc AST data. "Inline" custom nodes
  -- can store Inlines in these fields, "Block" custom nodes
  -- can store Blocks (and hence also Inlines implicitly).
  slots = { "title", "content" },

  constructor = function(tbl)
    quarto_global_state.hasCallouts = true

    local t = tbl.type
    local iconDefault = true
    local appearanceDefault = nil
    if t == "none" then
      iconDefault = false
      appearanceDefault = "simple"
    end
    local appearanceRaw = tbl.appearance
    if appearanceRaw == nil then
      appearanceRaw = option("callout-appearance", appearanceDefault)
    end

    local icon = tbl.icon
    if icon == nil then
      icon = option("callout-icon", iconDefault)
    elseif icon == "false" then
      icon = false
    end

    local appearance = nameForCalloutStyle(appearanceRaw);
    if appearance == "minimal" then
      icon = false
      appearance = "simple"
    end
    local content = pandoc.Blocks({})
    content:extend(quarto.utils.as_blocks(tbl.content))
    local title = tbl.title
    if type(title) == "string" then
      title = pandoc.Str(title)
    end
    return {
      title = title,
      collapse = tbl.collapse,
      content = content,
      appearance = appearance,
      icon = icon,
      type = t,
      attr = tbl.attr,
    }
  end
})

local calloutidx = 1

function docx_callout_and_table_fixup() 
  if not _quarto.format.isDocxOutput() then
    return {}
  end

  return {
  
    -- Insert paragraphs between consecutive callouts or tables for docx
    Blocks = function(blocks)
      if _quarto.format.isDocxOutput() then
        local lastWasCallout = false
        local lastWasTableOrFigure = false
        local newBlocks = pandoc.List()
        for i,el in ipairs(blocks) do 
          -- determine what this block is
          local isCallout = el.t == "Callout"
          local isTableOrFigure = el.t == "Table" or isFigureDiv(el) or (discoverFigure(el, true) ~= nil)
          local isCodeBlock = el.t == "CodeBlock"

          -- Determine whether this is a code cell that outputs a table
          local isCodeCell = el.t == "Div" and el.attr.classes:find_if(isCodeCell)
          if isCodeCell and (isCodeCellTable(el) or isCodeCellFigure(el)) then 
            isTableOrFigure = true
          end
          
          -- insert spacer if appropriate
          local insertSpacer = false
          if isCallout and (lastWasCallout or lastWasTableOrFigure) then
            insertSpacer = true
          end
          if isCodeBlock and lastWasCallout then
            insertSpacer = true
          end
          if isTableOrFigure and lastWasTableOrFigure then
            insertSpacer = true
          end

          if insertSpacer then
            newBlocks:insert(pandoc.Para(stringToInlines(" ")))
          end

          -- always insert
          newBlocks:insert(el)

          -- record last state
          lastWasCallout = isCallout
          lastWasTableOrFigure = isTableOrFigure
        end

        if #newBlocks > #blocks then
          return newBlocks
        else
          return nil
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
  _quarto.ast.walk(el, {
    Div = function(div)
      if div.attr.classes:find_if(isCodeCellDisplay) then
        _quarto.ast.walk(div, {
          Table = function(tbl)
            isTable = true
          end
        })
      end
    end
  })
  return isTable
end

function isCodeCellFigure(el)
  local isFigure = false
  _quarto.ast.walk(el, {
    Div = function(div)
      if div.attr.classes:find_if(isCodeCellDisplay) then
        if (isFigureDiv(div)) then
          isFigure = true
        elseif div.content and #div.content > 0 then 
          isFigure = discoverFigure(div.content[1], true) ~= nil
        end
      end
    end
  })
  return isFigure
end

-- an HTML callout div
function calloutDiv(node)
  -- the first heading is the title
  local div = pandoc.Div({})
  local c = quarto.utils.as_blocks(node.content)
  if pandoc.utils.type(c) == "Blocks" then
    div.content:extend(c)
  else
    div.content:insert(c)
  end
  local title = quarto.utils.as_inlines(node.title)
  local type = node.type
  local calloutAppearance = node.appearance
  local icon = node.icon
  local collapse = node.collapse

  if calloutAppearance == constants.kCalloutAppearanceDefault and pandoc.utils.stringify(title) == "" then
    title = displayName(type)
  end

  -- Make an outer card div and transfer classes and id
  local calloutDiv = pandoc.Div({})
  calloutDiv.attr = (node.attr or pandoc.Attr()):clone()
  div.attr.classes = pandoc.List() 
  div.attr.classes:insert("callout-body-container")

  -- add card attribute
  calloutDiv.attr.classes:insert("callout")
  calloutDiv.attr.classes:insert("callout-style-" .. calloutAppearance)
  if node.type ~= nil then
    calloutDiv.attr.classes:insert("callout-" .. node.type)
  end

  -- the image placeholder
  local noicon = ""

  -- Check to see whether this is a recognized type
  if icon == false or not isBuiltInType(type) or type == nil then
    noicon = " no-icon"
    calloutDiv.attr.classes:insert("no-icon")
  end
  local imgPlaceholder = pandoc.Plain({pandoc.RawInline("html", "<i class='callout-icon" .. noicon .. "'></i>")});       
  local imgDiv = pandoc.Div({imgPlaceholder}, pandoc.Attr("", {"callout-icon-container"}));

  -- show a titled callout
  if title ~= nil then

    -- mark the callout as being titleed
    calloutDiv.attr.classes:insert("callout-titled")

    -- create a unique id for the callout
    local calloutid = "callout-" .. calloutidx
    calloutidx = calloutidx + 1

    -- create the header to contain the title
    -- title should expand to fill its space
    local titleDiv = pandoc.Div(pandoc.Plain(title), pandoc.Attr("", {"callout-title-container", "flex-fill"}))
    local headerDiv = pandoc.Div({imgDiv, titleDiv}, pandoc.Attr("", {"callout-header", "d-flex", "align-content-center"}))
    local bodyDiv = div
    bodyDiv.attr.classes:insert("callout-body")

    if collapse ~= nil then 

      -- collapse default value     
      local expandedAttrVal= "true"
      if collapse == "true" or collapse == true then
        expandedAttrVal = "false"
      end

      -- create the collapse button
      local btnClasses = "callout-btn-toggle d-inline-block border-0 py-1 ps-1 pe-0 float-end"
      local btnIcon = "<i class='callout-toggle'></i>"
      local toggleButton = pandoc.RawInline("html", "<div class='" .. btnClasses .. "'>" .. btnIcon .. "</div>")
      headerDiv.content:insert(pandoc.Plain(toggleButton));

      -- configure the header div for collapse
      local bsTargetClz = calloutid .. "-contents"
      headerDiv.attr.attributes["bs-toggle"] = "collapse"
      headerDiv.attr.attributes["bs-target"] = "." .. bsTargetClz
      headerDiv.attr.attributes["aria-controls"] = calloutid
      headerDiv.attr.attributes["aria-expanded"] = expandedAttrVal
      headerDiv.attr.attributes["aria-label"] = 'Toggle callout'

      -- configure the body div for collapse
      local collapseDiv = pandoc.Div({})
      collapseDiv.attr.identifier = calloutid
      collapseDiv.attr.classes:insert(bsTargetClz)
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
    -- show an untitleed callout
  
    -- create a card body
    local containerDiv = pandoc.Div({imgDiv, div}, pandoc.Attr("", {"callout-body"}))
    containerDiv.attr.classes:insert("d-flex")

    -- add the container to the callout card
    calloutDiv.content:insert(containerDiv)
  end
  
  return calloutDiv
end

function epubCallout(node)
  local title = quarto.utils.as_inlines(node.title)
  local type = node.type
  local calloutAppearance = node.appearance
  local hasIcon = node.icon

  if calloutAppearance == constants.kCalloutAppearanceDefault and pandoc.utils.stringify(title) == nil then
    title = displayName(type)
  end
  
  -- the body of the callout
  local calloutBody = pandoc.Div({}, pandoc.Attr("", {"callout-body"}))

  local imgPlaceholder = pandoc.Plain({pandoc.RawInline("html", "<i class='callout-icon'></i>")});       
  local imgDiv = pandoc.Div({imgPlaceholder}, pandoc.Attr("", {"callout-icon-container"}));

  -- title
  if title ~= nil then
    local callout_title = pandoc.Div({}, pandoc.Attr("", {"callout-title"}))
    if hasIcon then
      callout_title.content:insert(imgDiv)
    end
    callout_title.content:insert(pandoc.Para(pandoc.Strong(title)))
    calloutBody.content:insert(callout_title)
  else 
    if hasIcon then
      calloutBody.content:insert(imgDiv)
    end
  end

  -- contents 
  local calloutContents = pandoc.Div(node.content, pandoc.Attr("", {"callout-content"}))
  calloutBody.content:insert(calloutContents)

  -- set attributes (including hiding icon)
  local attributes = pandoc.List({"callout"})
  if type ~= nil then
    attributes:insert("callout-" .. type)
  end

  if hasIcon == false then
    attributes:insert("no-icon")
  end
  if title ~= nil then
    attributes:insert("callout-titled")
  end
  attributes:insert("callout-style-" .. calloutAppearance)

  return pandoc.Div({calloutBody}, pandoc.Attr(node.id or "", attributes))
end

function simpleCallout(node) 
  local contents = resolveCalloutContents(node, true)
  local callout = pandoc.BlockQuote(contents)
  return pandoc.Div(callout, pandoc.Attr(node.id or ""))
end

function resolveCalloutContents(node, require_title)
  local title = quarto.utils.as_inlines(node.title)
  local type = node.type
  
  local contents = pandoc.List({})
    
  -- Add the titles and contents
  -- class_name 
  if pandoc.utils.stringify(title) == "" and require_title then 
    ---@diagnostic disable-next-line: need-check-nil
    title = stringToInlines(type:sub(1,1):upper()..type:sub(2))
  end
  
  -- raw paragraph with styles (left border, colored)
  if title ~= nil then
    contents:insert(pandoc.Para(pandoc.Strong(title)))
  end
  tappend(contents, quarto.utils.as_blocks(node.content))

  return contents
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

local kDefaultDpi = 96
function docxCalloutImage(type)

  -- If the DPI has been changed, we need to scale the callout icon
  local dpi = pandoc.WriterOptions(PANDOC_WRITER_OPTIONS)['dpi']
  local scaleFactor = 1
  if dpi ~= nil then
    scaleFactor = dpi / kDefaultDpi
  end

  -- try to form the svg name
  local svg = nil
  if type ~= nil then
    svg = param("icon-" .. type, nil)
  end

  -- lookup the image
  if svg ~= nil then
    local img = pandoc.Image({}, svg, '', {[constants.kProjectResolverIgnore]="true"})
    img.attr.attributes["width"] = tostring(16 * scaleFactor)
    img.attr.attributes["height"] = tostring(16 * scaleFactor)
    return img
  else
    return nil
  end
end

local callout_attrs = {
  note = {
    color = kColorNote,
    background_color = kBackgroundColorNote,
    latex_color = "quarto-callout-note-color",
    latex_frame_color = "quarto-callout-note-color-frame",
    fa_icon = "faInfo"
  },
  warning = {
    color = kColorWarning,
    background_color = kBackgroundColorWarning,
    latex_color = "quarto-callout-warning-color",
    latex_frame_color = "quarto-callout-warning-color-frame",
    fa_icon = "faExclamationTriangle"
  },
  important = {
    color = kColorImportant,
    background_color = kBackgroundColorImportant,
    latex_color = "quarto-callout-important-color",
    latex_frame_color = "quarto-callout-important-color-frame",
    fa_icon = "faExclamation"
  },
  caution = {
    color = kColorCaution,
    background_color = kBackgroundColorCaution,
    latex_color = "quarto-callout-caution-color",
    latex_frame_color = "quarto-callout-caution-color-frame",
    fa_icon = "faFire"
  },
  tip = {
    color = kColorTip,
    background_color = kBackgroundColorTip,
    latex_color = "quarto-callout-tip-color",
    latex_frame_color = "quarto-callout-tip-color-frame",
    fa_icon = "faLightbulb"
  },

  __other = {
    color = kColorUnknown,
    background_color = kColorUnknown,
    latex_color = "quarto-callout-color",
    latex_color_frame = "quarto-callout-color-frame",
    fa_icon = nil
  }
}

setmetatable(callout_attrs, {
  __index = function(tbl, key)
    return tbl.__other
  end
})

function htmlColorForType(type) 
  return callout_attrs[type].color
end

function htmlBackgroundColorForType(type)
  return callout_attrs[type].background_color
end

function latexColorForType(type) 
  return callout_attrs[type].latex_color
end

function latexFrameColorForType(type) 
  return callout_attrs[type].latex_frame_color
end

function iconForType(type) 
  return callout_attrs[type].fa_icon
end

function isBuiltInType(type)
  local icon = iconForType(type)
  return icon ~= nil
end

function displayName(type)
  local defaultName = type:sub(1,1):upper()..type:sub(2)
  return param("callout-" .. type .. "-title", defaultName)
end

-- default renderer first
_quarto.ast.add_renderer("Callout", function(_)
  return true
end, simpleCallout)
_quarto.ast.add_renderer("Callout", function(_)
  return _quarto.format.isHtmlOutput() and hasBootstrap()
end, calloutDiv)
_quarto.ast.add_renderer("Callout", function(_) 
  return _quarto.format.isEpubOutput() or _quarto.format.isRevealJsOutput()
end, epubCallout)
