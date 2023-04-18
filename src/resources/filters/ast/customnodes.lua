-- customnodes.lua
-- support for custom nodes in quarto's emulated ast
-- 
-- Copyright (C) 2022 by RStudio, PBC

local handlers = {}

local custom_node_data = pandoc.List({})
local n_custom_nodes = 0
local profiler = require('profiler')

function is_custom_node(node)
  if node.attributes.__quarto_custom == "true" then
    return node
  end
  return false
end

function run_emulated_filter(doc, filter)
  if doc == nil then
    return nil
  end
  local state = (preState or postState).extendedAstHandlers
  local needs_custom = false
  local sz = 0
  for k, v in pairs(filter) do
    sz = sz + 1
    if (k == "Custom" or 
        k == "CustomInline" or 
        k == "CustomBlock" or
        state[k] ~= nil) then
      needs_custom = true
    end
  end

  -- performance: if filter is empty, do nothing
  if sz == 0 then
    return doc
  elseif sz == 1 then
    local result
    local t
    if filter.Pandoc then
      -- performance: if filter is only Pandoc, call that directly instead of walking.
      result = filter.Pandoc(doc) or doc
    elseif filter.Meta then
      -- performance: if filter is only Meta, call that directly instead of walking.
      t = pandoc.utils.type(doc)
      if t == "Pandoc" then
        local result_meta = filter.Meta(doc.meta) or doc.meta
        result = doc
        result.meta = result_meta
      else
        goto regular
      end
    else
      goto regular
    end
    if in_filter then
      profiler.category = ""
    end
    return result
  end

  ::regular::

  local is_custom = is_custom_node(doc)
  if not needs_custom or (not is_custom and filter._is_wrapped) then
    local result, recurse = doc:walk(filter)
    if in_filter then
      profiler.category = ""
    end
    return result, recurse
  end
  -- assert: needs_custom and (is_custom or not filter._is_wrapped)

  local wrapped_filter = {
    _is_wrapped = true
  }

  for k, v in pairs(filter) do
    wrapped_filter[k] = v
  end

  local function process_custom_preamble(custom_data, t, kind, custom_node)
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

  if is_custom then
    local custom_data, t, kind = _quarto.ast.resolve_custom_data(doc)
    local result, recurse = process_custom_preamble(custom_data, t, kind, doc)
    if in_filter then
      profiler.category = ""
    end
    if result == nil then
      result = doc
    end
    return result, recurse
  end

  function wrapped_filter.Div(node)
    if is_custom_node(node) then
      local custom_data, t, kind = _quarto.ast.resolve_custom_data(node)
      -- here, if the node is actually an inline,
      -- it's ok, because Pandoc will wrap it in a Plain
      return process_custom_preamble(custom_data, t, kind, custom)
    end
    if filter.Div ~= nil then
      return filter.Div(node)
    end
    return nil
  end

  function wrapped_filter.Span(node)
    if is_custom_node(node) then
      local custom_data, t, kind = _quarto.ast.resolve_custom_data(node)
      -- only follow through if node matches the expected kind
      if kind == "Inline" then
        return process_custom_preamble(custom_data, t, kind, custom)
      end
      error("Custom node of type " .. t .. " is not an inline, but found in an inline context")
      crash_with_stack_trace()
      return nil
    end
    if filter.Span ~= nil then
      return filter.Span(node)
    end
    return nil
  end

  return doc:walk(wrapped_filter)
end

function create_emulated_node(t, tbl, context, forwarder)
  local result
  if context == "Block" then
    result = pandoc.Div({})
  elseif context == "Inline" then
    result = pandoc.Span({})
  else
    error("Invalid context for custom node: " .. context)
    crash_with_stack_trace()
  end
  n_custom_nodes = n_custom_nodes + 1
  result.attributes.__quarto_custom = "true"
  result.attributes.__quarto_custom_type = t
  result.attributes.__quarto_custom_context = context
  local id = tostring(n_custom_nodes)
  result.attributes.__quarto_custom_id = id
  tbl.t = t -- set t always to custom ast type
  custom_node_data[id] = _quarto.ast.set_proxy(result, tbl, forwarder)
  return result, tbl
end

_quarto.ast = {
  custom_node_data = custom_node_data,

  -- this is used in non-lua filters to handle custom nodes
  reset_custom_tbl = function(tbl)
    custom_node_data = tbl
    n_custom_nodes = #tbl
  end,

  set_proxy = function(div_or_span, custom_data, forwarder)
    local function grow(index)
      local n = #div_or_span.content
      local ctor = pandoc[pandoc.utils.type(div_or_span)]
      for _ = n + 1, index do
        div_or_span.content:insert(ctor({}))
      end
    end
    rawset(customdata, "__quarto_custom_node", div_or_span)

    setmetatable(custom_data, {
      __index = function(table, key)
        local index = forwarder[key]
        if index == nil then
          return rawget(table, key)
        end
        local node = rawget(table, "__quarto_custom_node")

        -- do we need to add more content containers?
        local content_container = node.content[index]
        if content_container == nil then
          grow(index)
          content_container = node.content[index]
        end
        
        local content = content_container.content
        if #content == 1 then
          return content[1]
        else
          return content
        end
      end,
      __newindex = function(table, key, value)
        local index = forwarder[key]
        if index == nil then
          rawset(table, key, value)
          return
        end
        local node = rawget(table, "__quarto_custom_node")

        -- do we need to add more content containers?
        local content_container = node.content[index]
        if content_container == nil then
          grow(index)
          content_container = node.content[index]
        end

        local pt = pandoc.utils.type(value)
        if pt == "Inlines" or pt == "Blocks" or pt == "table" then
          content_container.content = value
        else
          content_container.content = {value}
        end
      end,
    })
    return custom_data
  end,

  resolve_custom_data = function(div_or_span)
    if div_or_span.attributes.__quarto_custom ~= "true" then
      return
    end

    local t = div_or_span.attributes.__quarto_custom_type
    local n = div_or_span.attributes.__quarto_custom_id
    local kind = div_or_span.attributes.__quarto_custom_context
    local handler = _quarto.ast.resolve_handler(t)
    if handler == nil then
      error("Internal Error: handler not found for custom node " .. t)
      crash_with_stack_trace()
    end
    local custom_data = _quarto.ast.custom_node_data[n]

    return custom_data, t, kind
  end,
  
  add_handler = function(handler)
    local state = (preState or postState).extendedAstHandlers
    if type(handler.constructor) == "nil" then
      print("Internal Error: extended ast handler must have a constructor")
      quarto.utils.dump(handler)
      crash_with_stack_trace()
    elseif type(handler.forwarder) == "nil" then
      print("Internal Error: extended ast handler must have a forwarder")
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
      return create_emulated_node(handler.ast_name, tbl, handler.kind, handler.forwarder), tbl
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

  inner_walk = function(raw, filter)
    if raw == nil then
      return nil
    end
    local custom_data, t, kind = _quarto.ast.resolve_custom_data(raw)    
    local handler = _quarto.ast.resolve_handler(t)
    if handler == nil then
      if type(raw) == "userdata" then
        return raw:walk(filter)
      end
      print(raw)
      error("Internal Error: handler not found for custom node " .. (t or type(t)))
      crash_with_stack_trace()
    end

    if handler.inner_content ~= nil then
      local new_inner_content = {}
      local inner_content = handler.inner_content(custom_data)
      for k, v in pairs(inner_content) do
        local new_v = run_emulated_filter(v, filter)
        if new_v ~= nil then
          new_inner_content[k] = new_v
        end
      end
      handler.set_inner_content(custom_data, new_inner_content)
    end
  end,

  walk = run_emulated_filter,

  writer_walk = function(doc, filter)
    local old_custom_walk = filter.Custom
    local function custom_walk(node, raw)
      local handler = quarto._quarto.ast.resolve_handler(node.t)
      if handler == nil then
        error("Internal Error: handler not found for custom node " .. node.t)
        crash_with_stack_trace()
      end
      -- ensure inner nodes are also rendered
      quarto._quarto.ast.inner_walk(raw, filter)
      local result = handler.render(node)
      return quarto._quarto.ast.writer_walk(result, filter)
    end

    if filter.Custom == nil then
      filter.Custom = custom_walk
    end

    local result = run_emulated_filter(doc, filter)
    filter.Custom = old_custom_walk
    return result
  end
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