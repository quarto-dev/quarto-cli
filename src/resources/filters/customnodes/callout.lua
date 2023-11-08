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
      attr = tbl.attr or pandoc.Attr(),
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
      local lastWasCallout = false
      local lastWasTableOrFigure = false
      local newBlocks = pandoc.Blocks({})
      for i,el in ipairs(blocks) do 
        -- determine what this block is
        local isCallout = is_custom_node(el, "Callout")
        local isTableOrFigure = is_custom_node(el, "FloatRefTarget") or el.t == "Table" or isFigureDiv(el) or (discoverFigure(el, true) ~= nil)
        local isCodeBlock = el.t == "CodeBlock"

        -- Determine whether this is a code cell that outputs a table
        local isCodeCell = is_regular_node(el, "Div") and el.attr.classes:find_if(isCodeCell)
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

local function callout_title_prefix(callout, withDelimiter)
  local category = crossref.categories.by_ref_type[refType(callout.attr.identifier)]
  if category == nil then
    fail("unknown callout prefix '" .. refType(callout.attr.identifier) .. "'")
    return
  end

  return titlePrefix(category.ref_type, category.name, callout.order, withDelimiter)
end

function decorate_callout_title_with_crossref(callout)
  callout = ensure_custom(callout)
  if not param("enable-crossref", true) then
    -- don't decorate captions with crossrefs information if crossrefs are disabled
    return callout
  end
  -- nil should never happen here, but the Lua analyzer doesn't know it
  if callout == nil then
    -- luacov: disable
    internal_error()
    -- luacov: enable
    return callout
  end
  if not is_valid_ref_type(refType(callout.attr.identifier)) then
    return callout
  end
  local title = callout.title.content

  -- unlabeled callouts do not get a title prefix
  local is_uncaptioned = not ((title ~= nil) and (#title > 0))
  -- this is a hack but we need it to control styling downstream
  callout.is_uncaptioned = is_uncaptioned
  local title_prefix = callout_title_prefix(callout, not is_uncaptioned)
  tprepend(title, title_prefix)

  return callout
end

-- an HTML callout div
function calloutDiv(node)
  node = decorate_callout_title_with_crossref(node)

  -- the first heading is the title
  local div = pandoc.Div({})
  local c = quarto.utils.as_blocks(node.content)
  if pandoc.utils.type(c) == "Blocks" then
    div.content:extend(c)
  else
    div.content:insert(c)
  end
  local title = quarto.utils.as_inlines(node.title)
  local callout_type = node.type
  local calloutAppearance = node.appearance
  local icon = node.icon
  local collapse = node.collapse

  if calloutAppearance == constants.kCalloutAppearanceDefault and pandoc.utils.stringify(title) == "" then
    title = quarto.utils.as_inlines(pandoc.Plain(displayName(node.type)))
  end

  local identifier = node.attr.identifier
  if identifier ~= "" then
    node.attr.identifier = ""
    -- inject an anchor so callouts can be linked to
    local attr = pandoc.Attr(identifier, {}, {})
    local anchor = pandoc.Link({}, "", "", attr)
    title:insert(1, anchor)
  end

  -- Make an outer card div and transfer classes and id
  local calloutDiv = pandoc.Div({})
  calloutDiv.attr = node.attr:clone()
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
  if icon == false or not isBuiltInType(callout_type) or type == nil then
    noicon = " no-icon"
    calloutDiv.attr.classes:insert("no-icon")
  end
  local imgPlaceholder = pandoc.Plain({pandoc.RawInline("html", "<i class='callout-icon" .. noicon .. "'></i>")});       
  local imgDiv = pandoc.Div({imgPlaceholder}, pandoc.Attr("", {"callout-icon-container"}));

  -- show a titled callout
  if title ~= nil and (pandoc.utils.type(title) == "string" or next(title) ~= nil) then

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
      local expandedAttrVal = "true"
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

  if calloutAppearance == constants.kCalloutAppearanceDefault and pandoc.utils.stringify(title) == "" then
    title = displayName(type)
  end
  
  -- the body of the callout
  local calloutBody = pandoc.Div({}, pandoc.Attr("", {"callout-body"}))

  local imgPlaceholder = pandoc.Plain({pandoc.RawInline("html", "<i class='callout-icon'></i>")});       
  local imgDiv = pandoc.Div({imgPlaceholder}, pandoc.Attr("", {"callout-icon-container"}));

  -- title
  if title ~= nil and (pandoc.utils.type(title) == "string" or next(title) ~= nil) then
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
  if title ~= nil and (pandoc.utils.type(title) == "string" or next(title) ~= nil) then
    attributes:insert("callout-titled")
  end
  attributes:insert("callout-style-" .. calloutAppearance)

  local result = pandoc.Div({ calloutBody }, pandoc.Attr(node.attr.identifier or "", attributes))
  -- in revealjs or epub, if the leftover attr is non-trivial, 
  -- then we need to wrap the callout in a div (#5208, #6853)
  if node.attr.identifier ~= "" or #node.attr.classes > 0 or #node.attr.attributes > 0 then
    return pandoc.Div({ result }, node.attr)
  else
    return result
  end

end

function simpleCallout(node)
  node = decorate_callout_title_with_crossref(node)
  local contents = resolveCalloutContents(node, true)
  local callout = pandoc.BlockQuote(contents)
  local result = pandoc.Div(callout, pandoc.Attr(node.attr.identifier or ""))
  return result
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
    fa_icon = "faInfo",
    fa_icon_typst = "fa-info"
  },
  warning = {
    color = kColorWarning,
    background_color = kBackgroundColorWarning,
    latex_color = "quarto-callout-warning-color",
    latex_frame_color = "quarto-callout-warning-color-frame",
    fa_icon = "faExclamationTriangle",
    fa_icon_typst = "fa-exclamation-triangle"
  },
  important = {
    color = kColorImportant,
    background_color = kBackgroundColorImportant,
    latex_color = "quarto-callout-important-color",
    latex_frame_color = "quarto-callout-important-color-frame",
    fa_icon = "faExclamation",
    fa_icon_typst = "fa-exclamation"
  },
  caution = {
    color = kColorCaution,
    background_color = kBackgroundColorCaution,
    latex_color = "quarto-callout-caution-color",
    latex_frame_color = "quarto-callout-caution-color-frame",
    fa_icon = "faFire",
    fa_icon_typst = "fa-fire"
  },
  tip = {
    color = kColorTip,
    background_color = kBackgroundColorTip,
    latex_color = "quarto-callout-tip-color",
    latex_frame_color = "quarto-callout-tip-color-frame",
    fa_icon = "faLightbulb",
    fa_icon_typst = "fa-lightbulb"
  },

  __other = {
    color = kColorUnknown,
    background_color = kColorUnknown,
    latex_color = "quarto-callout-color",
    latex_color_frame = "quarto-callout-color-frame",
    fa_icon = nil,
    fa_icon_typst = nil
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

_quarto.ast.add_renderer("Callout", function(_)
  return _quarto.format.isGithubMarkdownOutput()
end, function(callout)
  local result = pandoc.Blocks({})
  local header = "[!" .. callout.type:upper() .. "]"
  result:insert(pandoc.RawBlock("markdown", header))
  local tt = pandoc.utils.type(callout.title)
  if tt ~= "nil" then 
    result:insert(pandoc.Header(3, quarto.utils.as_inlines(callout.title)))
  end
  local ct = pandoc.utils.type(callout.content)
  if ct == "Block" then
    result:insert(callout.content)
  elseif ct == "Blocks" then
    result:extend(callout.content)
  else
    internal_error()
  end
  return pandoc.BlockQuote(result)
end)

local function typst_function_call(name, params)
  local result = pandoc.Blocks({})
  result:insert(pandoc.RawInline("typst", "#" .. name .. "("))
  -- needs to be array of pairs because order matters for typst
  for i, pair in ipairs(params) do
    local k = pair[1]
    local v = pair[2]
    result:insert(pandoc.RawInline("typst", k .. ": "))
    result:extend(quarto.utils.as_blocks(v) or {})
    result:insert(pandoc.RawInline("typst", ", "))
  end
  result:insert(pandoc.RawInline("typst", ")"))
  return pandoc.Div(result)
end

local function as_typst_content(content)
  local result = pandoc.Blocks({})
  result:insert(pandoc.RawInline("typst", "[\n"))
  result:extend(quarto.utils.as_blocks(content) or {})
  result:insert(pandoc.RawInline("typst", "]\n"))
  return result
end

local included_font_awesome = false
local function ensure_typst_font_awesome()
  if included_font_awesome then
    return
  end
  included_font_awesome = true
  quarto.doc.include_text("in-header", "#import \"@preview/fontawesome:0.1.0\": *")
end

_quarto.ast.add_renderer("Callout", function(_)
  return _quarto.format.isTypstOutput()
end, function(callout)
  ensure_typst_font_awesome()

  local attrs = callout_attrs[callout.type]
  local background_color, icon_color, icon
  if attrs == nil then
    background_color = "white"
    icon_color = "black"
    icon = "fa-info"
  else
    background_color = "rgb(\"#" .. attrs.background_color .. "\")";
    icon_color = "rgb(\"#" .. attrs.color .. "\")";
    icon = attrs.fa_icon_typst
  end

  local title = callout.title
  if title == nil then
    title = pandoc.Plain(displayName(callout.type))
  end

  local typst_callout = typst_function_call("callout", { 
    { "body", as_typst_content(callout.content) },
    { "title", as_typst_content(title) },
    { "background_color", pandoc.RawInline("typst", background_color) },
    { "icon_color", pandoc.RawInline("typst", icon_color) },
    { "icon", pandoc.RawInline("typst", "" .. icon .. "()")}
  })

  if callout.attr.identifier == "" then
    return typst_callout
  end

  local category = crossref.categories.by_ref_type[refType(callout.attr.identifier)]
  return make_typst_figure {
    content = typst_callout,
    caption_location = "top",
    caption = pandoc.Plain(pandoc.Str("")),
    kind = "quarto-callout-" .. callout.type,
    supplement = category.name,
    numbering = "1",
    identifier = callout.attr.identifier
  }
end)

_quarto.ast.add_renderer("Callout", function(_)
  return _quarto.format.isDocxOutput()
end, function(callout)
  return calloutDocx(callout)
end)

function crossref_callouts()
  return {
    Callout = function(callout)
      local type = refType(callout.attr.identifier)
      if type == nil or not is_valid_ref_type(type) then
        return nil
      end
      local label = callout.attr.identifier
      local title = quarto.utils.as_blocks(callout.title)
      callout.order = add_crossref(label, type, title)
      return callout
    end
  }
end