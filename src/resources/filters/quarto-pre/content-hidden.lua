-- content-hidden.lua
-- Copyright (C) 2022 Posit Software, PBC


local kContentVisible = "content-visible"
local kContentHidden = "content-hidden"
local kWhenFormat = "when-format"
local kUnlessFormat = "unless-format"
local kWhenProfile = "when-profile"
local kUnlessProfile = "unless-profile"
local kConditions = pandoc.List({kWhenFormat, kUnlessFormat, kWhenProfile, kUnlessProfile})

_quarto.ast.add_handler({
  class_name = { kContentVisible, kContentHidden },
  
  ast_name = "ConditionalBlock",

  kind = "Block",

  parse = function(div)
    local behavior = div.classes:find(kContentVisible) or div.classes:find(kContentHidden)
    local condition = pandoc.List({})
    local remaining_attributes = pandoc.List({})
    for i, v in ipairs(div.attributes) do
      if kConditions:find(v[1]) ~= nil then
        condition:insert(v)
      else
        remaining_attributes:insert(v)
      end
    end
    div.attributes = remaining_attributes
    div.classes = div.classes:filter(function(k) return k ~= kContentVisible and k ~= kContentHidden end)
    return quarto.ConditionalBlock({
      node = div,
      behavior = behavior,
      condition = condition
    })
  end,

  render = function(node)
    local el = node.node
    local profiles = pandoc.List(param("quarto_profile", {}))
    if node.behavior == kContentVisible then
      return handleVisible(el, profiles)
    elseif node.behavior == kContentHidden then 
      return handleHidden(el, profiles)
    else
      return el
    end
  end,

  constructor = function(tbl)
    local result = {
      node = tbl.node,
      behavior = tbl.behavior,
      condition = pandoc.List({})
    };
    for i, v in ipairs(tbl.condition) do
      if kConditions:find(v[1]) == nil then
        error("Ignoring invalid condition in conditional block: " .. v[1])
      else
        result.condition:insert(v)
      end
    end

    return tbl
  end,

  inner_content = function(tbl)
    return {
      content = tbl.node.content,
    }
  end,

  set_inner_content = function(tbl, content)
    if content.content ~= nil then
      tbl.node.content = content.content
    end
  end
})

function contentHidden()
  local profiles = pandoc.List(param("quarto_profile", {}))
  return {
    -- Div = handleHiddenVisible(profiles),
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
