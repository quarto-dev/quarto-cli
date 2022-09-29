-- parse.lua
-- convert custom div inputs to custom nodes
--
-- Copyright (C) 2022 by RStudio, PBC

function parseExtendedNodes() 
  return {
    Div = function(div)
      local tag = pandoc.utils.stringify(div.attr.classes)
      local handler = quarto.ast.resolve_handler(tag)
      if handler == nil then
        return div
      end
      local divTable = handler.parse(div)

      return quarto.ast.copy_as_emulated_node(divTable)
    end
  }
end