-- render.lua
-- convert custom nodes to their final representation
--
-- Copyright (C) 2022 by RStudio, PBC

function render_raw(raw)
  local parts = split(raw.text)
  local t = parts[1]
  local n = tonumber(parts[2])
  local handler = _quarto.ast.resolve_handler(t)
  if handler == nil then
    error("Internal Error: handler not found for custom node " .. t)
    crash_with_stack_trace()
  end
  local customNode = _quarto.ast.custom_node_data[n]
  return handler.render(customNode)
end

function renderExtendedNodes()
  if string.find(FORMAT, ".lua$") then
    return {} -- don't render in custom writers, so we can handle them in the custom writer code.
  end

  return {
    Custom = function(node, raw)
      local handler = _quarto.ast.resolve_handler(node.t)
      if handler == nil then
        error("Internal Error: handler not found for custom node " .. node.t)
        crash_with_stack_trace()
      end
      return handler.render(node)
    end
  }
end