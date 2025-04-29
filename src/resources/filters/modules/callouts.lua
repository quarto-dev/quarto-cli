-- callouts.lua
-- Copyright (C) 2024 Posit Software, PBC

local constants = require("modules/constants")

local function callout_title_prefix(callout, withDelimiter)
  local category = crossref.categories.by_ref_type[refType(callout.attr.identifier)]
  if category == nil then
    fail("unknown callout prefix '" .. refType(callout.attr.identifier) .. "'")
    return
  end

  -- https://github.com/quarto-dev/quarto-cli/issues/10894
  -- honor custom callout title if it exists
  local default = param("callout-" .. callout.type .. "-title", category.name)

  return titlePrefix(category.ref_type, default, callout.order, withDelimiter)
end

local function decorate_callout_title_with_crossref(callout)
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
  if callout.title == nil then
    callout.title = pandoc.Plain({})
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

local function resolveCalloutContents(node, require_title)
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

local kDefaultDpi = 96
local function docxCalloutImage(type)

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
    color = constants.kColorNote,
    background_color = constants.kBackgroundColorNote,
    latex_color = "quarto-callout-note-color",
    latex_frame_color = "quarto-callout-note-color-frame",
    fa_icon = "faInfo",
    fa_icon_typst = "fa-info"
  },
  warning = {
    color = constants.kColorWarning,
    background_color = constants.kBackgroundColorWarning,
    latex_color = "quarto-callout-warning-color",
    latex_frame_color = "quarto-callout-warning-color-frame",
    fa_icon = "faExclamationTriangle",
    fa_icon_typst = "fa-exclamation-triangle"
  },
  important = {
    color = constants.kColorImportant,
    background_color = constants.kBackgroundColorImportant,
    latex_color = "quarto-callout-important-color",
    latex_frame_color = "quarto-callout-important-color-frame",
    fa_icon = "faExclamation",
    fa_icon_typst = "fa-exclamation"
  },
  caution = {
    color = constants.kColorCaution,
    background_color = constants.kBackgroundColorCaution,
    latex_color = "quarto-callout-caution-color",
    latex_frame_color = "quarto-callout-caution-color-frame",
    fa_icon = "faFire",
    fa_icon_typst = "fa-fire"
  },
  tip = {
    color = constants.kColorTip,
    background_color = constants.kBackgroundColorTip,
    latex_color = "quarto-callout-tip-color",
    latex_frame_color = "quarto-callout-tip-color-frame",
    fa_icon = "faLightbulb",
    fa_icon_typst = "fa-lightbulb"
  },

  __other = {
    color = constants.kColorUnknown,
    background_color = constants.kBackgroundColorUnknown,
    latex_color = "quarto-callout-color",
    latex_frame_color = "quarto-callout-color-frame",
    fa_icon = "faInfo",
    fa_icon_typst = "fa-info"
  }
}

setmetatable(callout_attrs, {
  __index = function(tbl, key)
    return tbl.__other
  end
})

local function htmlColorForType(type) 
  return callout_attrs[type].color
end

local function htmlBackgroundColorForType(type)
  return callout_attrs[type].background_color
end

local function latexColorForType(type) 
  return callout_attrs[type].latex_color
end

local function latexFrameColorForType(type) 
  return callout_attrs[type].latex_frame_color
end

local function iconForType(type) 
  return callout_attrs[type].fa_icon
end

local function isBuiltInType(type)
  local icon = iconForType(type)
  return icon ~= nil
end

local function displayName(type)
  local defaultName = type:sub(1,1):upper()..type:sub(2)
  return param("callout-" .. type .. "-title", defaultName)
end

local calloutidx = 1

-- an HTML callout div
local function calloutDiv(node)
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
  local found = false

  _quarto.ast.walk(title, {
    RawInline = function(_)
      found = true
    end,
    RawBlock = function(_)
      found = true
    end
  })

  if calloutAppearance == _quarto.modules.constants.kCalloutAppearanceDefault and pandoc.utils.stringify(title) == "" and not found then
    title = quarto.utils.as_inlines(pandoc.Plain(displayName(node.type)))
  end

  -- Make an outer card div and transfer classes and id
  local calloutDiv = pandoc.Div({})
  calloutDiv.attr = node.attr:clone()

  local identifier = node.attr.identifier
  if identifier ~= "" then
    node.attr.identifier = ""
    calloutDiv.attr.identifier = identifier
    -- inject an anchor so callouts can be linked to
    -- local attr = pandoc.Attr(identifier, {}, {})
    -- local anchor = pandoc.Link({}, "", "", attr)
    -- title:insert(1, anchor)
  end

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


return {
  decorate_callout_title_with_crossref = decorate_callout_title_with_crossref,
  callout_attrs = callout_attrs,

  render_to_bootstrap_div = calloutDiv,

  -- TODO capitalization
  resolveCalloutContents = resolveCalloutContents,
  docxCalloutImage = docxCalloutImage,

  htmlColorForType = htmlColorForType,
  htmlBackgroundColorForType = htmlBackgroundColorForType,
  latexColorForType = latexColorForType,
  latexFrameColorForType = latexFrameColorForType,
  iconForType = iconForType,
  isBuiltInType = isBuiltInType,
  displayName = displayName,
}