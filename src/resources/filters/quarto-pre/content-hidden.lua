-- content-hidden.lua
-- Copyright (C) 2022 by RStudio, PBC


local kContentVisible = "content-visible"
local kContentHidden = "content-hidden"
local kWhenFormat = "when-format"
local kUnlessFormat = "unless-format"
local kWhenProfile = "when-profile"
local kUnlessProfile = "unless-profile"

function contentHidden()
  local profiles = pandoc.List(param("quarto_profile", {}))
  return {
    Div = handleHiddenVisible(profiles),
    CodeBlock = handleHiddenVisible(profiles),
    Span = handleHiddenVisible(profiles)
  }
end

function handleHiddenVisible(profiles)
  return function(el)
    if el.attr.classes:find(kContentVisible) then
      return handleVisible(el, profiles)
    elseif el.attr.classes:find(kContentHidden) then
      return handleHidden(el, profiles)
    else
      return el
    end
  end
end

function attributesMatch(el, profiles)
  local match = true
  if el.attributes[kWhenFormat] ~= nil then
    match = match and _quarto.format.isFormat(el.attributes[kWhenFormat])
  end
  if el.attributes[kUnlessFormat] ~= nil then
    match = match and not _quarto.format.isFormat(el.attributes[kUnlessFormat])
  end
  if el.attributes[kWhenProfile] ~= nil then
    match = match and profiles:includes(el.attributes[kWhenProfile])
  end
  if el.attributes[kUnlessProfile] ~= nil then
    match = match and not profiles:includes(el.attributes[kUnlessProfile])
  end
  return match
end

function clearHiddenVisibleAttributes(el)
  el.attributes[kUnlessFormat] = nil
  el.attributes[kWhenFormat] = nil
  el.attributes[kUnlessProfile] = nil
  el.attributes[kWhenProfile] = nil
  el.attr.classes = removeClass(el.attr.classes, kContentVisible)
  el.attr.classes = removeClass(el.attr.classes, kContentHidden)
end

function handleVisible(el, profiles)
  local show = attributesMatch(el, profiles)
  clearHiddenVisibleAttributes(el)
  if not show then
    if el.t == "Span" then
      return pandoc.Span({})
    else
      return pandoc.Null()
    end
  end
  return el
end

function handleHidden(el, profiles)
  local hide = attributesMatch(el, profiles)
  clearHiddenVisibleAttributes(el)
  if hide then
    if el.t == "Span" then
      return pandoc.Span({})
    else
      return pandoc.Null()
    end
  end
  return el
end
