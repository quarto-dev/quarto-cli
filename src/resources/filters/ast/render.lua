function renderExtendedNodes() 
  if string.find(FORMAT, ".lua$") then
    return {}
  end

  return {
    Custom = function(customNode)
      local handler = quarto.ast.resolveHandler(customNode.t)
      if handler == nil then
        error("Internal Error: handler not found for custom node " .. customNode.t)
        crash_with_stack_trace()
      end
      return handler.render(customNode)
    end,
  }
end