-- customnodes.lua
-- support for custom nodes in quarto's emulated ast
-- 
-- Copyright (C) 2023 Posit Software, PBC

local handlers = {}

local custom_node_data = pandoc.List({})
local n_custom_nodes = 0
local profiler = require('profiler')

function scaffold(node)
  local pt = pandoc.utils.type(node)
  if pt == "Blocks" then
    return pandoc.Div(node, {"", {"quarto-scaffold"}})
  elseif pt == "Inlines" then
    return pandoc.Span(node, {"", {"quarto-scaffold"}})
  else
    return node
  end
end

function is_custom_node(node, name)
  if node.attributes and node.attributes.__quarto_custom == "true" then
    if name == nil or name == node.attributes.__quarto_custom_type then
      return node
    end
  end
  return false
end

function ensure_custom(node)
  if pandoc.utils.type(node) == "Block" or pandoc.utils.type(node) == "Inline" then
    local result = _quarto.ast.resolve_custom_data(node)
    return result or node -- it'll never be nil or false, but the lua analyzer doesn't know that
  end
  return node
end

-- use this instead of node.t == "Div" so that custom nodes
-- are not considered Divs
function is_regular_node(node, name)
  if type(node) ~= "userdata" then
    return false
  end
  if is_custom_node(node) then
    return false
  end
  if name ~= nil and node.t ~= name then
    return false
  end
  return node
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
        state.handlers.by_ast_name[k] ~= nil or
        -- we need custom handling to _avoid_ custom nodes as well.
        k == "Div" or
        k == "Span") then
      needs_custom = true
    end
  end

  local function checked_walk(node, filter_param)
    if node.walk == nil then
      if #node == 0 then -- empty node
        return node
      else
        -- luacov: disable
        internal_error()
        -- luacov: enable
      end
    end
    return node:walk(filter_param)
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

  -- if user passed a table corresponding to the custom node instead 
  -- of the custom node, then first we will get the actual node
  if doc.__quarto_custom_node ~= nil then
    doc = doc.__quarto_custom_node
    needs_custom = true
  end

  local is_custom = is_custom_node(doc)
  if not needs_custom or (not is_custom and filter._is_wrapped) then
    if doc.walk == nil then
      if #doc == 0 then -- empty doc
        return doc
      else
        -- luacov: disable
        internal_error()
        -- luacov: enable
      end
    end
    local result, recurse = checked_walk(doc, filter)
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
      return process_custom_preamble(custom_data, t, kind, node)
    end
    if node.attributes.__quarto_custom_scaffold == "true" then
      return nil
    end
    if node.identifier == _quarto.ast.vault._uuid then
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
        return process_custom_preamble(custom_data, t, kind, node)
      end
      -- luacov: disable
      fatal("Custom node of type " .. t .. " is not an inline, but found in an inline context")
      return nil
      -- luacov: enable
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
  return checked_walk(doc, wrapped_filter)
end

function create_custom_node_scaffold(t, context)
  local result
  if context == "Block" then
    result = pandoc.Div({})
  elseif context == "Inline" then
    result = pandoc.Span({})
  else
    -- luacov: disable
    fatal("Invalid context for custom node: " .. context)
    -- luacov: enable
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
  vault = {
    _uuid = "3ade8a4a-fb1d-4a6c-8409-ac45482d5fc9",

    _added = {},
    _removed = {},
    add = function(id, contents)
      _quarto.ast.vault._added[id] = contents
    end,
    remove = function(id)
      _quarto.ast.vault._removed[id] = true
    end,
    locate = function(doc)
      if doc == nil then
        doc = _quarto.ast._current_doc
      end
      -- attempt a fast lookup first
      if #doc.blocks > 0 and doc.blocks[#doc.blocks].identifier == _quarto.ast.vault._uuid then
        return doc.blocks[#doc.blocks]
      else
        -- otherwise search for it
        for _, block in ipairs(doc.blocks) do
          if block.identifier == _quarto.ast.vault._uuid then
            return block
          end
        end
      end
      return nil
    end,  
  },
  custom_node_data = custom_node_data,
  create_custom_node_scaffold = create_custom_node_scaffold,

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
        -- FIXME this is broken; that can only be "Block", "Inline", etc
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
    -- luacov: disable
    if handler == nil then
      fatal("Internal Error: handler not found for custom node " .. t)
    end
    -- luacov: enable
    local custom_data = _quarto.ast.custom_node_data[n]
    custom_data["__quarto_custom_node"] = div_or_span

    return custom_data, t, kind
  end,
  
  add_handler = function(handler)
    local state = quarto_global_state.extended_ast_handlers
    if type(handler.constructor) == "nil" then
      -- luacov: disable
      quarto.utils.dump(handler)
      fatal("Internal Error: extended ast handler must have a constructor")
      -- luacov: enable
    elseif type(handler.class_name) == "nil" then
      -- luacov: disable
      quarto.utils.dump(handler)
      fatal("handler must define class_name")
      -- luacov: enable
    elseif type(handler.class_name) == "string" then
      state.handlers[handler.kind][handler.class_name] = handler
    elseif type(handler.class_name) == "table" then
      for _, name in ipairs(handler.class_name) do
        state.handlers[handler.kind][name] = handler
      end
    else
      -- luacov: disable
      quarto.utils.dump(handler)
      fatal("ERROR: class_name must be a string or an array of strings")
      -- luacov: enable
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
    state.handlers.by_ast_name[handler.ast_name] = handler
  end,

  add_renderer = function(name, condition, renderer)
    if renderer == nil then
      -- luacov: disable
      fatal("Internal Error in add_renderer: renderer for " .. name .. " is nil")
      -- luacov: enable
    end

    local handler = _quarto.ast.resolve_handler(name)
    if handler == nil then
      -- luacov: disable
      fatal("Internal Error in add_renderer: handler not found for custom node " .. name)
      -- luacov: enable
    end
    if handler.renderers == nil then
      handler.renderers = { }
    end
    -- we insert renderers at the beginning of the list so that they have
    -- a chance to gtrigger before the default ones
    table.insert(handler.renderers, 1, { condition = condition, render = renderer })
  end,

  -- find handler by name in given table, or in the by_ast_name table if no table
  -- is specified.
  resolve_handler = function(name, key)
    local state = quarto_global_state.extended_ast_handlers
    local handlers = state.handlers[key or 'by_ast_name']
    if handlers ~= nil then
      return handlers[name]
    end
    -- TODO: should we just fail here? We seem to be failing downstream of every nil
    -- result anyway.
    -- luacov: disable
    return nil
    -- luacov: enable
  end,

  walk = run_emulated_filter,

  writer_walk = function(doc, filter)
    local old_custom_walk = filter.Custom
    local function custom_walk(node)
      local handler = quarto._quarto.ast.resolve_handler(node.t)
      if handler == nil then
        -- luacov: disable
        fatal("Internal Error: handler not found for custom node " .. node.t)
        -- luacov: enable
      end
      if handler.render == nil then
        -- luacov: disable
        fatal("Internal Error: handler for custom node " .. node.t .. " does not have a render function")
        -- luacov: enable
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
    handlers = {
      Inline = {},      -- Inline handlers by class name
      Block = {},       -- Block handlers by class name
      by_ast_name = {}, -- All handlers by Ast name
    },
  }

  if quarto_global_state ~= nil then
    quarto_global_state.extended_ast_handlers = state
  end

  -- we currently don't have any handlers at startup,
  -- so we disable coverage for this block
  -- luacov: disable
  for _, handler in ipairs(handlers) do
    _quarto.ast.add_handler(handler)
  end
  -- luacov: enable
end

construct_extended_ast_handler_state()
