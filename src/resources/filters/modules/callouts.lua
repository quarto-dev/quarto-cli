-- callouts.lua
-- Copyright (C) 2024 Posit Software, PBC

local constants = require("modules/constants")

local function callout_title_prefix(callout, withDelimiter)
  local category = crossref.categories.by_ref_type[refType(callout.attr.identifier)]
  if category == nil then
    fail("unknown callout prefix '" .. refType(callout.attr.identifier) .. "'")
    return
  end

  return titlePrefix(category.ref_type, category.name, callout.order, withDelimiter)
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

return {
  decorate_callout_title_with_crossref = decorate_callout_title_with_crossref,
  callout_attrs = callout_attrs,

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