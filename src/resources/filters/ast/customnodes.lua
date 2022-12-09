-- customnodes.lua
-- support for custom nodes in quarto's emulated ast
-- 
-- Copyright (C) 2022 by RStudio, PBC

local handlers = {}

local custom_tbl_to_node = pandoc.List({})
local n_custom_nodes = 0

function run_emulated_filter(doc, filter)
  local custom_nodes_content = pandoc.List({})

  local custom_filter = {
    RawInline = function(raw)
      if raw.format ~= "QUARTO_custom" then
        return
      end
      local parts = mysplit(raw.text, " ")
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
        local inner_content = handler.inner_content(custom_tbl_to_node[n])
        for k, v in pairs(inner_content) do
          local new_v = v:walk(filter)
          if new_v ~= nil then
            new_inner_content[k] = new_v
          end
        end
        handler.set_inner_content(custom_tbl_to_node[n], new_inner_content)
      end
    end
  }

  local wrapped_filter = {}
  if filter.RawInline ~= nil then
  else
    setmetatable(wrapped_filter, {
      __index = custom_filter
    })
  end
  setmetatable(wrapped_filter, {
    __index = function(t, k)
      if k == "RawInline" then
        return function(raw)

        end
      end
    end
  });

  local emulated_filter = {
    Pandoc = function(doc)
      custom_nodes_content = pandoc.Blocks(custom_nodes_content):walk(real_filter)
    
      print("walking custom nodes")
      result = result:walk(custom_filter)
    
      return result, false
    end  
  }

  local newDoc = doc:walk(filter)
  if newDoc ~= nil then
    doc = newDoc
  end
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