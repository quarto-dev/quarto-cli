function parseExtendedNodes() 
  return {
    Div = function(div)
      local tag = pandoc.utils.stringify(div.attr.classes)
      local handler = quarto.ast.resolveHandler(tag)
      if handler == nil then
        return div
      end
      local divTable = handler.parse(div)

      return quarto.ast.copyAsExtendedNode(divTable)
    end
  }
end