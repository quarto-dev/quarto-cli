-- customnodes.lua
-- support for custom nodes in quarto's emulated ast
-- 
-- Copyright (C) 2022 by RStudio, PBC

local handlers = {
  {
    -- use either string or array of strings
    class_name = "fancy-callout",
    -- class_name = {"fancy-callout-warning", "fancy-callout-info", ... }

    -- optional: makePandocExtendedDiv
    -- This is here as an escape hatch, we expect most developers
    -- to not need it.
    -- makePandocExtendedDiv = function(table)
    --   -- returns a pandoc Div that can be parsed back into a table
    --   -- later use
    -- end

    -- the name of the ast node, used as a key in extended ast filter tables
    ast_name = "FancyCallout",

    -- a function that takes the div node as supplied in user markdown
    -- and returns the custom node
    parse = function(div)
      return quarto.ast.custom("FancyCallout", {
        title = div.content[1],
        content = div.content[2],
      })
    end,

    -- a function that renders the extended node into output
    render = function(extendedNode)
      return pandoc.Div(pandoc.Blocks({
        extendedNode.title, extendedNode.content
      }))
    end,

    -- a function that takes the extended node and
    -- returns a table with table-valued attributes
    -- that represent inner content that should
    -- be visible to filters.
    inner_content = function(extended_node)
      return {
        title = extended_node.title,
        content = extended_node.content
      }
    end,

    -- a function that updates the extended node
    -- with new inner content (as returned by filters)
    -- table keys are a subset of those returned by inner_content
    -- and represent changed values that need to be updated.    
    set_inner_content = function(extended_node, values)
      if values.title then
        extended_node.title = values.title
      end
      if values.content then
        extended_node.content = values.content
      end
    end
  },
}

local kExtendedAstTag = "quarto-extended-ast-tag"

quarto.ast = {
  custom = function(name, tbl)
    local result = create_emulated_node(name, true)
    for k, v in pairs(tbl) do
      result[k] = v
    end
    return result
  end,

  copy_as_emulated_node = function(el)
    -- this will probably crash other places, but they shouldn't be calling us like this anyway
    if el == nil then return nil end

    if type(el) ~= "table" and type(el) ~= "userdata" then
      error("Internal Error: copy_as_emulated_node can't handle type " .. type(el))
      crash_with_stack_trace()
      return create_emulated_node("Div") -- a lie to appease to type system
    end

    local emulatedNode = create_emulated_node(
      el.t or pandoc.utils.type(el),
      el.is_custom or false
    )

    if pandoc_fixed_field_types[el.t] and pandoc_fixed_field_types[el.t].attr then
      emulatedNode.attr = pandoc.Attr(el.attr)
    end

    function is_content_field(k)
      return k ~= "walk" and k ~= "clone" and k ~= "show"
    end

    for k, v in pairs(el) do
      if is_content_field(k) then
        emulatedNode[k] = v
      end
    end
    return emulatedNode
  end,

  to_emulated = to_emulated,
  from_emulated = from_emulated,
  
  add_handler = function(handler)
    local state = (preState or postState).extendedAstHandlers
    if type(handler.class_name) == "nil" then
      print("ERROR: handler must define class_name")
      quarto.utils.dump(handler)
      crash_with_stack_trace()
    elseif type(handler.class_name) == "string" then
      state.namedHandlers[handler.class_name] = handler
    elseif type(handler.class_name) == "table" then
      for _, name in ipairs(handler.class_name) do
        state.namedHandlers[name] = handler
      end
    else
      print("ERROR: class_name must be a string or an array of strings")
      quarto.utils.dump(handler)
      crash_with_stack_trace()
    end

    -- we also register them under the ast_name so that we can render it back
    state.namedHandlers[handler.ast_name] = handler
  end,

  resolve_handler = function(name)
    local state = (preState or postState).extendedAstHandlers
    if state.namedHandlers ~= nil then
      return state.namedHandlers[name]
    end
    return nil
  end,


  unbuild = function(emulatedNode)
    local name = emulatedNode.attr.attributes["quarto-extended-ast-tag"]
    local handler = quarto.ast.resolve_handler(name)
    if handler == nil then
      print("ERROR: couldn't find a handler for " .. name)
      crash_with_stack_trace()
    end
    local divTable = { attr = emulatedNode.attr }
    local key
    for i, v in ipairs(emulatedNode.content) do
      if i % 2 == 1 then
        key = pandoc.utils.stringify(v)
      else
        divTable[key] = v
      end
    end
    divTable.class = pandoc.utils.stringify(divTable.class)
    return divTable
  end,

  build = function(name, nodeTable)
    local handler = quarto.ast.resolve_handler(name)
    if handler == nil then
      print("Internal Error: couldn't find a handler for " .. tostring(name))
      crash_with_stack_trace()
      return pandoc.Div({}, {}) -- a lie to appease the type system
    end
    if handler.makePandocExtendedDiv then
      return handler.makePandocExtendedDiv(nodeTable)
    end

    local resultAttr
    local blocks = {}
    for key, value in pairs(nodeTable) do
      if key == "attr" then
        resultAttr = value
      else
        table.insert(blocks, pandoc.Str(key))
        table.insert(blocks, value)
      end                    
    end
    if resultAttr == nil then
      resultAttr = pandoc.Attr("", { name }, {})
    end
    resultAttr.attributes[kExtendedAstTag] = name
    return pandoc.Div(blocks, resultAttr)
  end,
}

function constructExtendedAstHandlerState()
  local state = {
    namedHandlers = {},
  }

  if preState ~= nil then
    preState.extendedAstHandlers = state
  end
  if postState ~= nil then
    postState.extendedAstHandlers = state
  end

  for _, handler in ipairs(handlers) do
    quarto.ast.add_handler(handler)
  end
end

constructExtendedAstHandlerState()