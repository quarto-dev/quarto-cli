-- customnodes.lua
-- support for custom nodes in quarto's emulated ast
-- 
-- Copyright (C) 2022 by RStudio, PBC

local handlers = {}

local custom_node_data = pandoc.List({})
local n_custom_nodes = 0

function resolve_custom_node(node)
  if type(node) == "userdata" and node.t == "Plain" and #node.content == 1 and node.content[1].t == "RawInline" and node.content[1].format == "QUARTO_custom" then
    return node.content[1]
  end
  if type(node) == "userdata" and node.t == "RawInline" and node.format == "QUARTO_custom" then
    return node
  end
end

function run_emulated_filter(doc, filter)
  local wrapped_filter = {}
  for k, v in pairs(filter) do
    wrapped_filter[k] = v
  end

  function process_custom_inner(raw)
    if raw == nil then
      return nil
    end
    local custom_data, t, kind = _quarto.ast.resolve_custom_data(raw)    
    local handler = _quarto.ast.resolve_handler(t)
    if handler == nil then
      if type(raw) == "userdata" then
        return raw:walk(wrapped_filter)
      end
      print(raw)
      error("Internal Error: handler not found for custom node " .. (t or type(t)))
      crash_with_stack_trace()
    end
    if handler.inner_content ~= nil then
      local new_inner_content = {}
      local inner_content = handler.inner_content(custom_data)

      for k, v in pairs(inner_content) do
        local new_v = v:walk(wrapped_filter)
        if new_v ~= nil then
          new_inner_content[k] = new_v
        end
      end
      handler.set_inner_content(custom_data, new_inner_content)
    end
  end

  function process_custom_preamble(custom_data, t, kind, custom_node)
    if custom_data == nil then
      return nil
    end
    local node_type = {
      Block = "CustomBlock",
      Inline = "CustomInline"
    }
    local filter_fn = filter[t] or filter[node_type[kind]] or filter.Custom

    if filter_fn ~= nil then
      return filter_fn(custom_data, custom_node)
    end
  end

  function process_custom(custom_data, t, kind, custom_node)
    local result, recurse = process_custom_preamble(custom_data, t, kind, custom_node)
    if filter.traverse ~= "topdown" or recurse then
      if tisarray(result) then
        local new_result = {}
        for i, v in ipairs(result) do
          if type(v) == "table" then
            new_result[i] = quarto[t](v) --- create new custom object of the same kind as passed and recurse.
          else
            new_result[i] = v
          end
          process_custom_inner(new_result[i])
        end
        return new_result, recurse
        
      elseif type(result) == "table" then
        local new_result = quarto[t](result)
        process_custom_inner(new_result or custom_node)
        return result, recurse
      elseif result == nil then
        process_custom_inner(custom_node)
        return nil, recurse
      else
        -- something non-custom was returned, we just send it along.
        return result, recurse
      end
    else
      -- non-recursing traversal
      if tisarray(result) then
        local new_result = {}
        for i, v in ipairs(result) do
          if type(v) == "table" then
            new_result[i] = quarto[t](v) --- create new custom object of the same kind as passed.
          else
            new_result[i] = v
          end
        end
        return new_result, recurse
      elseif type(result) == "table" then
        local new_result = quarto[t](result)
        return new_result, recurse
      else
        return result, recurse
      end
    end
  end

  function wrapped_filter.Plain(node)
    local custom = resolve_custom_node(node)

    if custom then
      local custom_data, t, kind = _quarto.ast.resolve_custom_data(custom)
      -- only follow through if node matches the expected kind
      if kind == "Block" then
        return process_custom(custom_data, t, kind, custom)
      else
        return nil
      end
    else
      if filter.Plain ~= nil then
        return filter.Plain(node)
      else
        return nil
      end
    end
  end

  function wrapped_filter.RawInline(node)
    local custom = resolve_custom_node(node)

    if custom then
      local custom_data, t, kind = _quarto.ast.resolve_custom_data(custom)
      -- only follow through if node matches the expected kind
      if kind == "Inline" then
        return process_custom(custom_data, t, kind, custom)
      else
        return nil
      end
    else
      if filter.RawInline ~= nil then
        return filter.RawInline(node)
      else
        return nil
      end
    end
  end

  local result = doc:walk(wrapped_filter)
  add_trace(result, filter._filter_name)
  return result
end

function create_emulated_node(t, tbl, context)
  n_custom_nodes = n_custom_nodes + 1
  local result = pandoc.RawInline("QUARTO_custom", tostring(t .. " " .. n_custom_nodes .. " " .. context))
  custom_node_data[n_custom_nodes] = tbl
  tbl.t = t -- set t always to custom ast type
  return result
end

_quarto.ast = {
  custom_node_data = custom_node_data,

  -- this is used in non-lua filters to handle custom nodes
  reset_custom_tbl = function(tbl)
    custom_node_data = tbl
    n_custom_nodes = #tbl
  end,

  resolve_custom_data = function(raw_or_plain_container)
    if type(raw_or_plain_container) ~= "userdata" then
      error("Internal Error: resolve_custom_data called with non-pandoc node")
      error(type(raw_or_plain_container))
      crash_with_stack_trace()
    end
    local raw

    if raw_or_plain_container.t == "RawInline" then
      raw = raw_or_plain_container
    elseif raw_or_plain_container.t == "Plain" and #raw_or_plain_container.content == 1 and raw_or_plain_container.content[1].t == "RawInline" then
      raw = raw_or_plain_container.content[1]
    else
      return nil
    end

    if raw.format ~= "QUARTO_custom" then
      return
    end

    local parts = split(raw.text, " ")
    local t = parts[1]
    local n = tonumber(parts[2])
    local kind = parts[3]
    local handler = _quarto.ast.resolve_handler(t)
    if handler == nil then
      error("Internal Error: handler not found for custom node " .. t)
      crash_with_stack_trace()
    end
    local custom_node = _quarto.ast.custom_node_data[n]
    return custom_node, t, kind
  end,
  
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
      return create_emulated_node(handler.ast_name, tbl, handler.kind), tbl
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