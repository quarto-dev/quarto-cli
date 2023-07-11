-- customnodes.lua
-- support for custom nodes in quarto's emulated ast
-- 
-- Copyright (C) 2023 Posit Software, PBC

local handlers = {}

local custom_node_data = pandoc.List({})
local n_custom_nodes = 0
local profiler = require('profiler')

function is_custom_node(node)
  if node.attributes and node.attributes.__quarto_custom == "true" then
    return node
  end
  return false
end

function run_emulated_filter(doc, filter)
  if doc == nil then
    return nil
  end

  local state = quarto_global_state.extended_ast_handlers
  local needs_custom = false
  local sz = 0
  for k, v in pairs(filter) do
    sz = sz + 1
    if (k == "Custom" or 
        k == "CustomInline" or 
        k == "CustomBlock" or
        state.namedHandlers[k] ~= nil or
        -- we need custom handling to _avoid_ custom nodes as well.
        k == "Div" or
        k == "Span") then
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

  -- if user passed the table corresponding to the a custom node instead 
  -- of the custom node, then first we will get the actual node
  local converted = false
  if doc.__quarto_custom_node ~= nil then
    doc = doc.__quarto_custom_node
    needs_custom = true
    converted = true
    print("CONVERTED", converted)
  end

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
      local result, recurse = filter_fn(custom_data, custom_node)
      if result == nil then
        return nil, recurse
      end
      -- do the user a kindness and unwrap the result if it's a custom node
      if type(result) == "table" and result.__quarto_custom_node ~= nil then
        return result.__quarto_custom_node, recurse
      end
      return result, recurse
    end
  end

  function wrapped_filter.Div(node)
    if is_custom_node(node) then
      local custom_data, t, kind = _quarto.ast.resolve_custom_data(node)
      -- here, if the node is actually an inline,
      -- it's ok, because Pandoc will wrap it in a Plain
      return process_custom_preamble(custom_data, t, kind, custom)
    end
    if node.attributes.__quarto_custom_scaffold == "true" then
      return nil
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
      fatal("Custom node of type " .. t .. " is not an inline, but found in an inline context")
      return nil
    end
    if node.attributes.__quarto_custom_scaffold == "true" then
      return nil
    end
    if filter.Span ~= nil then
      return filter.Span(node)
    end
    return nil
  end

  if is_custom then
    local custom_data, t, kind = _quarto.ast.resolve_custom_data(doc)
    local result, recurse = process_custom_preamble(custom_data, t, kind, doc)
    if in_filter then
      profiler.category = ""
    end
    if result ~= nil then
      doc = result
    end
    if recurse == false then
      return doc, recurse
    end
  end

  return doc:walk(wrapped_filter)
end

function create_custom_node_scaffold(t, context)
  local result
  if context == "Block" then
    result = pandoc.Div({})
  elseif context == "Inline" then
    result = pandoc.Span({})
  else
    fatal("Invalid context for custom node: " .. context)
  end
  n_custom_nodes = n_custom_nodes + 1
  local id = tostring(n_custom_nodes)
  result.attributes.__quarto_custom = "true"
  result.attributes.__quarto_custom_type = t
  result.attributes.__quarto_custom_context = context
  result.attributes.__quarto_custom_id = id

  return result
end

function create_emulated_node(t, tbl, context, forwarder)
  local result = create_custom_node_scaffold(t, context)
  tbl.t = t -- set t always to custom ast type
  local id = result.attributes.__quarto_custom_id

  custom_node_data[id] = _quarto.ast.create_proxy_accessor(result, tbl, forwarder)
  return result, custom_node_data[id]
end

_quarto.ast = {
  custom_node_data = custom_node_data,
  create_custom_node_scaffold = create_custom_node_scaffold,

  -- FIXME WE NEED TO REDO THIS WITH PROXY OBJECTS
  -- 
  -- -- this is used in non-lua filters to handle custom nodes
  -- reset_custom_tbl = function(tbl)
  --   custom_node_data = tbl
  --   n_custom_nodes = #tbl
  -- end,

  grow_scaffold = function(node, size)
    local n = #node.content
    local ctor = pandoc[node.t or pandoc.utils.type(node)]
    for _ = n + 1, size do
      local scaffold = ctor({})
      scaffold.attributes.__quarto_custom_scaffold = "true"
      node.content:insert(scaffold)
    end
  end,

  create_proxy_metatable = function(forwarder, node_accessor)
    node_accessor = node_accessor or function(table)
      return table["__quarto_custom_node"]
    end
    return {
      __index = function(table, key)
        local index = forwarder(key)
        if index == nil then
          return rawget(table, key)
        end
        local node = node_accessor(table)
        local content = node.content
        if index > #content then
          return nil
        end
        local result = content[index]
        if result == nil then
          return nil
        end
        local t = result.t
        -- if not (t == "Div" or t == "Span") then
        --   warn("Custom node content is not a Div or Span, but a " .. t)
        --   return nil
        -- end
        local content = result.content
        if content == nil then
          return nil
        end
        local n = #content
        if n == 0 then
          return nil
        elseif n ~= 1 then
          return content
        else
          return content[1]
        end
      end,
      __newindex = function(table, key, value)
        local index = forwarder(key)
        if index == nil then
          rawset(table, key, value)
          return
        end
        local node = node_accessor(table)
        local t = pandoc.utils.type(value)
        if t == "Div" or t == "Span" then
          local custom_data, t, kind = _quarto.ast.resolve_custom_data(value)
          if custom_data ~= nil then
            value = custom_data
          end
        end
        if index > #node.content then
          _quarto.ast.grow_scaffold(node, index)
        end
        local pt = pandoc.utils.type(value)
        if pt == "Block" or pt == "Inline" then
          node.content[index].content = {value}
        else
          node.content[index].content = value
        end
      end
    }
  end,

  create_proxy_accessor = function(div_or_span, custom_data, forwarder)
    if forwarder == nil then
      return custom_data
    end

    local proxy = {
      __quarto_custom_node = div_or_span
    }
    setmetatable(proxy, _quarto.ast.create_proxy_metatable(function(key)
      return forwarder[key]
    end))

    for k, v in pairs(custom_data) do
      proxy[k] = v
    end
    return proxy
  end,

  resolve_custom_data = function(div_or_span)
    if (div_or_span == nil or
        div_or_span.attributes == nil or 
        div_or_span.attributes.__quarto_custom ~= "true") then
      return
    end

    local t = div_or_span.attributes.__quarto_custom_type
    local n = div_or_span.attributes.__quarto_custom_id
    local kind = div_or_span.attributes.__quarto_custom_context
    local handler = _quarto.ast.resolve_handler(t)
    if handler == nil then
      fatal("Internal Error: handler not found for custom node " .. t)
    end
    local custom_data = _quarto.ast.custom_node_data[n]
    custom_data["__quarto_custom_node"] = div_or_span

    return custom_data, t, kind
  end,
  
  add_handler = function(handler)
    local state = quarto_global_state.extended_ast_handlers
    if type(handler.constructor) == "nil" then
      quarto.utils.dump(handler)
      fatal("Internal Error: extended ast handler must have a constructor")
    elseif type(handler.class_name) == "nil" then
      quarto.utils.dump(handler)
      fatal("handler must define class_name")
    elseif type(handler.class_name) == "string" then
      state.namedHandlers[handler.class_name] = handler
    elseif type(handler.class_name) == "table" then
      for _, name in ipairs(handler.class_name) do
        state.namedHandlers[name] = handler
      end
    else
      quarto.utils.dump(handler)
      fatal("ERROR: class_name must be a string or an array of strings")
    end

    local forwarder = { }
    if tisarray(handler.slots) then
      for i, slot in ipairs(handler.slots) do
        forwarder[slot] = i
      end
    else
      forwarder = handler.slots
    end

    quarto[handler.ast_name] = function(params)
      local tbl, need_emulation = handler.constructor(params)

      if need_emulation ~= false then
        return create_emulated_node(handler.ast_name, tbl, handler.kind, forwarder)
      else
        tbl.t = handler.ast_name -- set t always to custom ast type
        custom_node_data[tbl.__quarto_custom_node.attributes.__quarto_custom_id] = tbl
        return tbl.__quarto_custom_node, tbl
      end
    end

    -- we also register them under the ast_name so that we can render it back
    state.namedHandlers[handler.ast_name] = handler
  end,

  add_renderer = function(name, condition, renderer)
    local handler = _quarto.ast.resolve_handler(name)
    if handler == nil then
      fatal("Internal Error in add_renderer: handler not found for custom node " .. name)
    end
    if handler.renderers == nil then
      handler.renderers = { }
    end
    -- we insert renderers at the beginning of the list so that they have
    -- a chance to gtrigger before the default ones
    table.insert(handler.renderers, 1, { condition = condition, render = renderer })
  end,

  resolve_handler = function(name)
    local state = quarto_global_state.extended_ast_handlers
    if state.namedHandlers ~= nil then
      return state.namedHandlers[name]
    end
    return nil
  end,

  walk = run_emulated_filter,

  writer_walk = function(doc, filter)
    local old_custom_walk = filter.Custom
    local function custom_walk(node)
      local handler = quarto._quarto.ast.resolve_handler(node.t)
      if handler == nil then
        fatal("Internal Error: handler not found for custom node " .. node.t)
      end
      return handler.render(node)
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

function construct_extended_ast_handler_state()
  local state = {
    namedHandlers = {},
  }

  if quarto_global_state ~= nil then
    quarto_global_state.extended_ast_handlers = state
  end

  for _, handler in ipairs(handlers) do
    _quarto.ast.add_handler(handler)
  end
end

construct_extended_ast_handler_state()