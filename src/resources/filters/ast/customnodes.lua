-- customnodes.lua
-- support for custom nodes in quarto's emulated ast
-- 
-- Copyright (C) 2022 by RStudio, PBC

local handlers = {}

local custom_tbl_to_node = pandoc.List({})
local n_custom_nodes = 0

function resolve_custom(node)
  if type(node) == "userdata" and node.t == "Plain" and #node.content == 1 and node.content[1].t == "RawInline" and node.content[1].format == "QUARTO_custom" then
    return node.content[1], "CustomBlock"
  end
  if type(node) == "userdata" and node.t == "RawInline" and node.format == "QUARTO_custom" then
    return node, "CustomInline"
  end
end

function run_emulated_filter(doc, filter)
  local custom_nodes_content = pandoc.List({})

  function process_custom_inner(raw)
    local parts = split(raw.text, " ")
    local t = parts[1]
    local n = tonumber(parts[2])
    local handler = _quarto.ast.resolve_handler(t)
    if handler == nil then
      error("Internal Error: handler not found for custom node " .. t)
      crash_with_stack_trace()
    end
    local custom_node = _quarto.ast.custom_tbl_to_node[n]
    
    if handler.inner_content ~= nil then
      local new_inner_content = {}
      local inner_content = handler.inner_content(custom_node)
      for k, v in pairs(inner_content) do
        local new_v = v:walk(filter)
        if new_v ~= nil then
          new_inner_content[k] = new_v
        end
      end
      handler.set_inner_content(custom_node, new_inner_content)
    end
  end

  function process_custom_preamble(raw, node_type)
    local parts = split(raw.text, " ")
    local t = parts[1]
    local n = tonumber(parts[2])
    local handler = _quarto.ast.resolve_handler(t)
    if handler == nil then
      error("Internal Error: handler not found for custom node " .. t)
      crash_with_stack_trace()
    end
    local custom_node = _quarto.ast.custom_tbl_to_node[n]

    local filter_fn = filter[t] or filter[node_type] or filter.Custom

    if filter_fn ~= nil then
      return filter_fn(custom_node)
    end
  end

  function process_custom(node)
    local custom, node_type = resolve_custom(node)
    if custom ~= nil then
      node = process_custom_preamble(custom, node_type)
      if type(node) == "table" then
        for i, v in ipairs(table) do
          local inner_node, _ = resolve_custom(inner_node)
          if inner_node ~= nil then
            process_custom_inner(inner_node)
          end
        end
      elseif type(node) == "userdata" then
        local inner_node, _ = resolve_custom(node)
        if inner_node ~= nil then
          process_custom_inner(inner_node)
        end
      end
      return node
    end
  end,

  local custom_filter = {
    Plain = process_custom,
    RawInline = process_custom,
  }

  local custom_filter_check = {
    Plain = function(node)
      local custom = resolve_custom(node)
      if custom then
        return process_custom(node)
      else
        if filter.Plain ~= nil then
          return filter.Plain(node)
        else
          return nil
        end
      end
    end,
    RawInline = function(node)
      local custom = resolve_custom(node)
      if custom then
        return process_custom(node)
      else
        if filter.RawInline ~= nil then
          return filter.RawInline(node)
        else
          return nil
        end
      end
    end,
  }

  local wrapped_filter = {}
  if filter.RawInline ~= nil or filter.Plain == nil then
    setmetatable(wrapped_filter, {
      __index = custom_filter_check
    })
  else
    setmetatable(wrapped_filter, {
      __index = custom_filter
    })
  end

  local emulated_filter = {
    traverse = "topdown",
    Pandoc = function(doc)
      return doc:walk(wrapped_filter), false
    end  
  }

 return doc:walk(emulated_filter)
end

function create_emulated_node(t, tbl)
  n_custom_nodes = n_custom_nodes + 1
  local result = pandoc.RawInline("QUARTO_custom", tostring(t .. " " .. n_custom_nodes))
  custom_tbl_to_node[n_custom_nodes] = tbl
  return result
end

_quarto.ast = {
  custom_tbl_to_node = custom_tbl_to_node,
  add_handler = function(handler)
    local state = (preState or postState).extendedAstHandlers
    if type(handler.constructor) == "nil" then
      print("Internal Error: extended ast handler must have a constructor")
      quarto.utils.dump(handler)
      crash_with_stack_trace()
    elseif type(handler.class_name) == "nil" then
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

    quarto[handler.ast_name] = function(...)
      local tbl = handler.constructor(...)
      return create_emulated_node(handler.ast_name, tbl)
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
}
quarto._quarto = _quarto

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
    _quarto.ast.add_handler(handler)
  end
end

constructExtendedAstHandlerState()