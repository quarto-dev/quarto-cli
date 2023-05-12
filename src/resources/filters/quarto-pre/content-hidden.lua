-- content-hidden.lua
-- Copyright (C) 2022 Posit Software, PBC


local constants = require("../modules/constants")

local kConditions = pandoc.List({constants.kWhenFormat, constants.kUnlessFormat, constants.kWhenProfile, constants.kUnlessProfile})

function is_visible(node)
  local profiles = pandoc.List(param("quarto_profile", {}))
  local match = propertiesMatch(node.condition, profiles)
  if node.behavior == constants.kContentVisible then
    return match
  elseif node.behavior == constants.kContentHidden then
    return not match
  else
    fatal("Internal Error: invalid behavior for conditional block: " .. node.behavior)
    return false
  end
end

_quarto.ast.add_handler({
  class_name = { constants.kContentVisible, constants.kContentHidden },
  
  ast_name = "ConditionalBlock",

  kind = "Block",

  parse = function(div)
    local behavior = div.classes:find(constants.kContentVisible) or div.classes:find(constants.kContentHidden)
    local condition = pandoc.List({})
    local remaining_attributes = pandoc.List({})
    for i, v in ipairs(div.attributes) do
      if constants.kConditions:find(v[1]) ~= nil then
        condition:insert(v)
      else
        remaining_attributes:insert(v)
      end
    end
    div.attributes = remaining_attributes
    div.classes = div.classes:filter(function(k) return k ~= constants.kContentVisible and k ~= constants.kContentHidden end)

    return quarto.ConditionalBlock({
      node = div,
      behavior = behavior,
      condition = condition
    })
  end,

  slots = { "node" },

  render = function(node)
    local visible = is_visible(node)
    if visible then
      local el = node.node
      clearHiddenVisibleAttributes(el)
      return el.content
    else
      return {}
    end
  end,

  constructor = function(tbl)
    local result = {
      node = tbl.node,
      original_node = tbl.node:clone(), -- keep it around in case filters need to inspect it
      behavior = tbl.behavior,
      condition = pandoc.List({})
    };
    for i, v in ipairs(tbl.condition or {}) do
      if kConditions:find(v[1]) == nil then
        error("Ignoring invalid condition in conditional block: " .. v[1])
      else
        result.condition[v[1]] = v[2]
      end
    end

    if not is_visible(result) then
      -- if the block is not visible, clear out the content
      -- before filters are run on document
      result.node.content = {}
    end

    return result
  end,

})

function content_hidden()
  local profiles = pandoc.List(param("quarto_profile", {}))
  return {
    -- Div = handleHiddenVisible(profiles),
    CodeBlock = handleHiddenVisible(profiles),
    Span = handleHiddenVisible(profiles)
  }
end

function handleHiddenVisible(profiles)
  return function(el)
    local visible
    if el.attr.classes:find(constants.kContentVisible) then
      clearHiddenVisibleAttributes(el)
      visible = propertiesMatch(el.attributes, profiles)
    elseif el.attr.classes:find(constants.kContentHidden) then
      clearHiddenVisibleAttributes(el)
      visible = not propertiesMatch(el.attributes, profiles)
    else
      return el
    end
    -- this is only called on spans and codeblocks, so here we keep the scaffolding element
    -- as opposed to in the Div where we return the inlined content
    if visible then
      return el
    else
      return {}
    end
  end
end

-- "properties" here will come either from "conditions", in the case of a custom AST node
-- or from the attributes of the element itself in the case of spans or codeblocks
function propertiesMatch(properties, profiles)
  local match = true
  if properties[constants.kWhenFormat] ~= nil then
    match = match and _quarto.format.isFormat(properties[constants.kWhenFormat])
  end
  if properties[constants.kUnlessFormat] ~= nil then
    match = match and not _quarto.format.isFormat(properties[constants.kUnlessFormat])
  end
  if properties[constants.kWhenProfile] ~= nil then
    match = match and profiles:includes(properties[constants.kWhenProfile])
  end
  if properties[constants.kUnlessProfile] ~= nil then
    match = match and not profiles:includes(properties[constants.kUnlessProfile])
  end
  return match
end

function clearHiddenVisibleAttributes(el)
  el.attributes[constants.kUnlessFormat] = nil
  el.attributes[constants.kWhenFormat] = nil
  el.attributes[constants.kUnlessProfile] = nil
  el.attributes[constants.kWhenProfile] = nil
  el.attr.classes = removeClass(el.attr.classes, constants.kContentVisible)
  el.attr.classes = removeClass(el.attr.classes, constants.kContentHidden)
end