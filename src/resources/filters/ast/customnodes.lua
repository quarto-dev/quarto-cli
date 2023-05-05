-- customnodes.lua
-- support for custom nodes in quarto's emulated ast
-- 
-- Copyright (C) 2022 by RStudio, PBC

local handlers = {}

local custom_node_data = pandoc.List({})
local n_custom_nodes = 0
local profiler = require('profiler')

function resolve_custom_node(node)
  local t = node.t
  if t == "Plain" then
    local c = node.content[1]
    if c and c.format == "QUARTO_custom" then
      return c
    else
      return false
    end
  end
  if t == "RawInline" and node.format == "QUARTO_custom" then
    return node
  end
  return false
end

function run_emulated_filter(doc, filter)
  if doc == nil then
    return nil
  end
  local sz = 0
  for k, v in pairs(filter) do
    sz = sz + 1
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

  local custom = resolve_custom_node(doc)

  if custom == nil and filter._is_wrapped then
    local result, recurse = doc:walk(filter)
    if in_filter then
      profiler.category = ""
    end
    return result, recurse
  end

  local wrapped_filter = {}
  for k, v in pairs(filter) do
    wrapped_filter[k] = v
  end

  local function process_custom_inner(raw)
    _quarto.ast.inner_walk(raw, wrapped_filter)
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

  local function process_custom(custom_data, t, kind, custom_node)
    local result, recurse = process_custom_preamble(custom_data, t, kind, custom_node)
    if filter.traverse ~= "topdown" or recurse ~= false then
      if tisarray(result) then
        ---@type table<number, table|pandoc.Node>
        local array_result = result ---@diagnostic disable-line
        local new_result = {}
        for i, v in ipairs(array_result) do
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
        return new_result, recurse
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

  if custom then
    local custom_data, t, kind = _quarto.ast.resolve_custom_data(custom)
    local result, recurse = process_custom(custom_data, t, kind, custom)
    if in_filter then
      profiler.category = ""
    end
    if result == nil then
      return doc
    end
    return result, recurse
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

  wrapped_filter._is_wrapped = true

  local result, recurse = doc:walk(wrapped_filter)

  return result, recurse
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
    elseif (raw_or_plain_container.t == "Plain" or
            raw_or_plain_container.t == "Para") and #raw_or_plain_container.content == 1 and raw_or_plain_container.content[1].t == "RawInline" then
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