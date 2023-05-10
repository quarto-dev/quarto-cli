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
    fatal("Internal Error: handler not found for custom node " .. t)
  end
  local customNode = _quarto.ast.custom_node_data[n]
  return handler.render(customNode)
end

function render_extended_nodes()
  if string.find(FORMAT, ".lua$") then
    return {} -- don't render in custom writers, so we can handle them in the custom writer code.
  end

  return {
    Custom = function(node)
      local handler = _quarto.ast.resolve_handler(node.t)
      if handler == nil then
        fatal("Internal Error: handler not found for custom node " .. node.t)
      end
      if handler.renderers then
        for _, renderer in ipairs(handler.renderers) do
          if renderer.condition(node) then
            quarto.utils.dump { node = node, render = render }
            return renderer.render(node)
          end
        end
        quarto.utils.dump(node)
        fatal("Internal Error: renderers table was exhausted without a match for custom node " .. node.t)
      elseif handler.render ~= nil then
        return handler.render(node)
      else
        fatal("Internal Error: handler for custom node " .. node.t .. " does not have a render function or renderers table")
      end
    end
  }
end