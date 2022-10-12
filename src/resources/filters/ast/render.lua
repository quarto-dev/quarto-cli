-- render.lua
-- convert custom nodes to their final representation
--
-- Copyright (C) 2022 by RStudio, PBC

function renderExtendedNodes()
  if string.find(FORMAT, ".lua$") then
    return {}
  end

  return {
    Custom = function(customNode)
      local handler = quarto.ast.resolve_handler(customNode.t)
      if handler == nil then
        error("Internal Error: handler not found for custom node " .. customNode.t)
        crash_with_stack_trace()
      end
      return handler.render(customNode)
    end,
  }
end